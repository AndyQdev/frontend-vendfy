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
import { crearDetector, type Lectura } from "./detector";

/**
 * El escáner de todo el panel.
 *
 * Se monta una sola vez, en el marco de las pantallas (LayoutShell), y desde
 * ahí escucha la pistola en cualquier ruta. Por defecto, cada lectura abre la
 * hoja del producto. Una pantalla puede quedarse con las lecturas mientras
 * está abierta —Caja las carga directo al carrito— con
 * `useManejadorEscaneo`.
 */

export type ContextoHoja = "general" | "caja";

export interface AbrirHojaOpciones {
  /** Si la pantalla ya lo buscó, para no pedirlo dos veces. */
  resultado?: ResultadoEscaneo;
  /** Se llama cuando el producto quedó registrado desde la hoja. */
  alRegistrar?: (resultado: ResultadoEscaneo) => void;
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
  registrarManejador: (manejador: ManejadorEscaneo) => () => void;
}

const Ctx = createContext<ScannerCtx | null>(null);

const HOJA_CERRADA: EstadoHoja = { abierta: false, codigo: "", clave: 0 };

export function ScannerProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [hoja, setHoja] = useState<EstadoHoja>(HOJA_CERRADA);
  const [pulso, setPulso] = useState(0);
  // Pila: la última pantalla que se registró es la que manda.
  const manejadores = useRef<ManejadorEscaneo[]>([]);

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

  const registrarManejador = useCallback((manejador: ManejadorEscaneo) => {
    manejadores.current.push(manejador);
    return () => {
      manejadores.current = manejadores.current.filter((m) => m !== manejador);
    };
  }, []);

  useEffect(() => {
    // Señal de que la pistola ya se escucha: las pruebas E2E la esperan en
    // vez de adivinar cuánto tarda en montarse el panel.
    document.documentElement.dataset.escaner = "listo";
    const quitar = crearDetector(async (lectura) => {
      // El campo "Código de barras" de un formulario se lo quedó: no hay más
      // que hacer.
      if (lectura.paraCampo) return;
      setPulso((p) => p + 1);
      const manejador = manejadores.current[manejadores.current.length - 1];
      if (manejador) {
        try {
          if (await manejador(lectura)) return;
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

  const valor = useMemo(
    () => ({ hoja, abrir, cerrar, buscar, pulso, registrarManejador }),
    [hoja, abrir, cerrar, buscar, pulso, registrarManejador],
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
 */
export function useManejadorEscaneo(manejador: ManejadorEscaneo, activo = true) {
  const { registrarManejador } = useEscaner();
  const ref = useRef(manejador);
  ref.current = manejador;

  useEffect(() => {
    if (!activo) return;
    return registrarManejador((lectura) => ref.current(lectura));
  }, [activo, registrarManejador]);
}
