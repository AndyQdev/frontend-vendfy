import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import { buscarPorCodigo, claveEscaneo } from "@/entities/product/api";
import type { ResultadoEscaneo } from "@/entities/product/model/escaneo";
import { precalentarVoz, prepararAudio, usePreferenciasVoz } from "@/shared/voz";
import { crearDetector, type Lectura } from "./detector";

/**
 * El escáner de todo el panel.
 *
 * Se monta una sola vez, en el marco de las pantallas (LayoutShell), y desde
 * ahí escucha la pistola en cualquier ruta. Por defecto, cada lectura abre la
 * hoja del producto. Una pantalla puede quedarse con las lecturas mientras
 * está abierta —Caja las carga directo al carrito, Nueva compra a su tabla, el
 * asistente al chat, Inventario abre el ajuste de stock— con
 * `useManejadorEscaneo`.
 */

/**
 * Desde dónde se abrió la hoja para dar de alta. Fuera de "general", al
 * registrar se cierra sola: la pantalla que la abrió sigue con el producto.
 */
export type ContextoHoja = "general" | "caja" | "compra" | "asistente" | "inventario" | "live";

export interface AbrirHojaOpciones {
  /** Si la pantalla ya lo buscó, para no pedirlo dos veces. */
  resultado?: ResultadoEscaneo;
  /**
   * Se llama cuando el producto quedó registrado desde la hoja. En una compra
   * trae cuántos se compraron: entran por la compra, no como stock inicial.
   */
  alRegistrar?: (resultado: ResultadoEscaneo, alta: { cantidad: number }) => void;
  /** Cambia los textos y el botón principal ("Registrar y agregar a la venta"). */
  contexto?: ContextoHoja;
}

export interface EstadoHoja extends AbrirHojaOpciones {
  abierta: boolean;
  codigo: string;
  /** Cambia en cada lectura: reinicia formularios y animaciones de la hoja. */
  clave: number;
}

/** Devuelve true si se ocupó de la lectura; false deja que abra la hoja. */
export type ManejadorEscaneo = (lectura: Lectura) => boolean | Promise<boolean>;

interface ScannerCtx {
  hoja: EstadoHoja;
  abrir: (codigo: string, opciones?: AbrirHojaOpciones) => void;
  cerrar: () => void;
  /** Busca un código con caché corta: escanear dos veces seguidas no repite el pedido. */
  buscar: (codigo: string) => Promise<ResultadoEscaneo>;
  /** Sube en cada lectura: dispara el destello del láser. */
  pulso: number;
  registrarManejador: (manejador: ManejadorEscaneo, etiqueta?: string) => () => void;
  /** Qué hace la pistola en esta pantalla ("Agrega al carrito"). null: muestra el producto. */
  etiqueta: string | null;
  /** Ya se usó una pistola en este navegador: recién ahí se muestra el indicador. */
  usado: boolean;
}

const Ctx = createContext<ScannerCtx | null>(null);

const HOJA_CERRADA: EstadoHoja = { abierta: false, codigo: "", clave: 0 };
const CLAVE_USADO = "vendfy.escaner.usado";

interface Registro {
  manejador: ManejadorEscaneo;
  etiqueta?: string;
}

export function ScannerProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [hoja, setHoja] = useState<EstadoHoja>(HOJA_CERRADA);
  const [pulso, setPulso] = useState(0);
  // Pila: la última pantalla que se registró es la que manda.
  const manejadores = useRef<Registro[]>([]);
  const [etiqueta, setEtiqueta] = useState<string | null>(null);
  const [usado, setUsado] = useState(() => {
    try {
      return localStorage.getItem(CLAVE_USADO) === "1";
    } catch {
      return false;
    }
  });
  const usadoRef = useRef(usado);

  const buscar = useCallback(
    (codigo: string) =>
      queryClient.fetchQuery({
        queryKey: claveEscaneo(codigo),
        queryFn: ({ signal }) => buscarPorCodigo(codigo, signal),
        staleTime: 5_000,
      }),
    [queryClient],
  );

  const abrir = useCallback((codigo: string, opciones: AbrirHojaOpciones = {}) => {
    if (opciones.resultado) {
      queryClient.setQueryData(claveEscaneo(codigo), opciones.resultado);
    }
    setHoja((previa) => ({
      abierta: true,
      codigo,
      clave: previa.clave + 1,
      contexto: opciones.contexto ?? "general",
      alRegistrar: opciones.alRegistrar,
      resultado: opciones.resultado,
    }));
  }, [queryClient]);

  const cerrar = useCallback(() => setHoja((previa) => ({ ...previa, abierta: false })), []);

  const registrarManejador = useCallback((manejador: ManejadorEscaneo, etiquetaPantalla?: string) => {
    const registro: Registro = { manejador, etiqueta: etiquetaPantalla };
    const alDia = () => setEtiqueta(manejadores.current[manejadores.current.length - 1]?.etiqueta ?? null);
    manejadores.current.push(registro);
    alDia();
    return () => {
      manejadores.current = manejadores.current.filter((r) => r !== registro);
      alDia();
    };
  }, []);

  useEffect(() => {
    // Señal de que la pistola ya se escucha: las pruebas E2E la esperan en
    // vez de adivinar cuánto tarda en montarse el panel.
    document.documentElement.dataset.escaner = "listo";
    const quitar = crearDetector(async (lectura) => {
      const registro = manejadores.current[manejadores.current.length - 1];
      // El campo "Código de barras" de un formulario se quedó con el código.
      // La pantalla puede usarlo además (Crear producto completa el resto con
      // el catálogo), pero la hoja no se abre encima del formulario.
      if (lectura.paraCampo) {
        if (!registro) return;
        setPulso((p) => p + 1);
        try {
          await registro.manejador(lectura);
        } catch {
          // El código ya quedó en el campo: no hay nada que rescatar.
        }
        return;
      }
      setPulso((p) => p + 1);
      if (!usadoRef.current) {
        usadoRef.current = true;
        setUsado(true);
        try {
          localStorage.setItem(CLAVE_USADO, "1");
        } catch {
          // Sin almacenamiento el indicador aparece desde la primera lectura de cada visita.
        }
      }
      if (registro) {
        try {
          if (await registro.manejador(lectura)) return;
        } catch {
          // Si la pantalla falló, que al menos se vea el producto.
        }
      }
      abrir(lectura.codigo);
    });
    return () => {
      quitar();
      delete document.documentElement.dataset.escaner;
    };
  }, [abrir]);

  // La voz que dice los precios: el audio se despierta con el primer gesto, y
  // los precios del comercio se generan de antemano para que suenen al
  // instante (sin apurar la carga del panel).
  const { voz, precios } = usePreferenciasVoz();
  useEffect(() => {
    prepararAudio();
  }, []);
  useEffect(() => {
    if (!precios) return;
    const reloj = window.setTimeout(() => void precalentarVoz(), 3000);
    return () => window.clearTimeout(reloj);
  }, [voz, precios]);

  const valor = useMemo(
    () => ({ hoja, abrir, cerrar, buscar, pulso, registrarManejador, etiqueta, usado }),
    [hoja, abrir, cerrar, buscar, pulso, registrarManejador, etiqueta, usado],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useEscaner() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useEscaner debe usarse dentro de ScannerProvider");
  return ctx;
}

/**
 * La pantalla se queda con las lecturas mientras está montada. El manejador
 * puede cambiar en cada render (cierra sobre el carrito actual): se guarda
 * en una ref y siempre se llama al último.
 *
 * `etiqueta` es lo que el indicador del encabezado dice que hace la pistola
 * en esta pantalla ("Agrega al carrito"): nadie tendría que adivinarlo.
 */
export function useManejadorEscaneo(manejador: ManejadorEscaneo, activo = true, etiqueta?: string) {
  const { registrarManejador } = useEscaner();
  const ref = useRef(manejador);
  ref.current = manejador;

  useEffect(() => {
    if (!activo) return;
    return registrarManejador((lectura) => ref.current(lectura), etiqueta);
  }, [activo, etiqueta, registrarManejador]);
}
