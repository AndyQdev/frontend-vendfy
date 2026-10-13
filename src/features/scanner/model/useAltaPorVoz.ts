import { useCallback, useEffect, useRef, useState } from "react";

import { altaPorVoz, type CambiosAltaVoz, type FormularioAltaVoz } from "@/entities/product/api";
import { callarVoz, decirFrases, esperarQueCalle, preferenciasVoz, type FraseVoz } from "@/shared/voz";
import { contestar, type MemoriaAlta } from "./conversacion-alta";
import { ESPERA_MS, precargarEscucha, useEscucha, type EstadoEscucha } from "./escucha";

/**
 * La conversación del alta por voz.
 *
 * Al abrirse el formulario la voz dice "No está registrado. ¿Lo damos de
 * alta?" y, cuando termina, escucha. Cada frase recibe respuesta: confirma
 * lo que anotó ("Listo. Veinte bolivianos. Cinco en stock."), contesta si
 * preguntó algo y pide lo que falta ("Dime el precio de venta."). Así se sabe
 * que escuchó y qué decir después, sin mirar la pantalla.
 *
 * Registra solo si la persona lo pide con todas las letras ("regístralo") y
 * el formulario pasa sus validaciones de siempre.
 */

export type FaseVoz =
  | EstadoEscucha
  | "procesando"
  | "escribiendo"
  | "hablando"
  | "listo"
  | "sin-voz"
  | "error";

/** Vueltas seguidas sin entender nada: después, se deja de escuchar solo. */
const MAX_SIN_PROGRESO = 2;
/** Tope de vueltas automáticas en un mismo formulario. */
const MAX_VUELTAS = 14;

/** La última vuelta de la conversación, para mostrarla bajo el título. */
export interface Dialogo {
  /** Lo que dijo la persona. */
  tu: string | null;
  /** Lo que le contestó Vendfy. */
  vendfy: string | null;
}

interface Opciones {
  /** La preferencia "Escuchar al dar de alta". Apagada: solo escucha si se toca el indicador. */
  automatico: boolean;
  storeId: string | null;
  /** Los valores de este momento (no los del render en que se creó la función). */
  formulario: () => FormularioAltaVoz;
  categorias: string[];
  cantidadEs: "stock" | "compra";
  /** Escribe los cambios en el formulario, con su efecto. */
  aplicar: (cambios: CambiosAltaVoz) => Promise<void>;
  /** Registra con las validaciones del formulario. false si falta algo. */
  registrar: () => boolean;
}

export function useAltaPorVoz({ automatico, storeId, formulario, categorias, cantidadEs, aplicar, registrar }: Opciones) {
  // Lo que la escucha no sabe: procesando, hablando, el ✓, el silencio, un error.
  const [propia, setPropia] = useState<FaseVoz | null>(null);
  const [dialogo, setDialogo] = useState<Dialogo>({ tu: null, vendfy: automatico ? "¿Lo damos de alta?" : null });
  const propiaRef = useRef(propia);
  propiaRef.current = propia;
  const vivo = useRef(true);
  const sinProgreso = useRef(0);
  const vueltas = useRef(0);
  const memoria = useRef<MemoriaAlta>({ preguntoCantidad: false, dijoComoRegistrar: false });

  const datos = useRef({ storeId, formulario, categorias, cantidadEs, aplicar, registrar });
  datos.current = { storeId, formulario, categorias, cantidadEs, aplicar, registrar };

  // Las funciones se llaman entre sí; la ref evita el ciclo de dependencias.
  const hablarYEscucharRef = useRef<(frases: FraseVoz[]) => Promise<void>>(async () => {});

  const alHablar = useCallback(async (wav: Blob) => {
    const d = datos.current;
    if (!d.storeId) return;
    setPropia("procesando");
    try {
      const r = await altaPorVoz({
        audio: wav,
        storeId: d.storeId,
        formulario: d.formulario(),
        categorias: d.categorias,
        cantidadEs: d.cantidadEs,
      });
      if (!vivo.current) return;
      const dicho = r.transcripcion.texto.trim();
      setDialogo((x) => ({ ...x, tu: dicho || "…" }));

      if (Object.keys(r.cambios).length) {
        setPropia("escribiendo");
        await datos.current.aplicar(r.cambios);
        if (!vivo.current) return;
        setPropia("listo");
      }

      const f = datos.current.formulario();
      const c = contestar(
        r,
        { nombre: f.nombre, precio: f.precio, cantidad: f.cantidad ?? 0 },
        datos.current.cantidadEs,
        memoria.current,
      );
      sinProgreso.current = c.progreso ? 0 : sinProgreso.current + 1;
      setDialogo((x) => ({ ...x, vendfy: c.texto }));

      if (c.registrar) {
        decirFrases(c.frases);
        if (!datos.current.registrar()) {
          setDialogo((x) => ({ ...x, vendfy: "Falta un dato: revisa lo marcado en rojo." }));
        }
        setPropia(null);
        return;
      }
      if (sinProgreso.current > MAX_SIN_PROGRESO) {
        setDialogo((x) => ({ ...x, vendfy: "Toca el micrófono cuando quieras seguir." }));
        setPropia(null);
        return;
      }
      await hablarYEscucharRef.current(c.frases);
    } catch {
      if (!vivo.current) return;
      setDialogo((x) => ({ ...x, vendfy: "No pude procesar el audio. Toca el micrófono para intentarlo de nuevo." }));
      setPropia("error");
    }
  }, []);

  const alCallar = useCallback(() => {
    setPropia("sin-voz");
    setDialogo((x) => ({ ...x, vendfy: "No te escuché. Toca el micrófono cuando quieras seguir." }));
    setTimeout(() => vivo.current && setPropia((f) => (f === "sin-voz" ? null : f)), 2500);
  }, []);

  const escucha = useEscucha(alHablar, alCallar);
  const escuchaRef = useRef(escucha);
  escuchaRef.current = escucha;

  /** Dice lo que tenga que decir y, cuando termina, vuelve a escuchar. */
  hablarYEscucharRef.current = async (frases) => {
    if (!vivo.current) return;
    if (vueltas.current >= MAX_VUELTAS) {
      setPropia(null);
      return;
    }
    vueltas.current++;
    if (frases.length && preferenciasVoz().precios) {
      setPropia("hablando");
      decirFrases(frases);
      // Recién cuando calla: si no, el micrófono graba la pregunta.
      await esperarQueCalle({ arranqueMs: 3000, topeMs: 25_000 });
      if (!vivo.current) return;
    }
    setPropia(null);
    await escuchaRef.current.escuchar(ESPERA_MS);
  };

  /** El indicador: empezar a escuchar, terminar de hablar o callar la voz. */
  const tocar = useCallback(() => {
    const e = escuchaRef.current.estado;
    if (e === "escuchando") {
      // Terminó de hablar antes del silencio: se entrega ya.
      escuchaRef.current.terminar();
      return;
    }
    if (e === "esperando" || e === "preparando") {
      escuchaRef.current.detener();
      setPropia(null);
      return;
    }
    if (propiaRef.current === "procesando" || propiaRef.current === "escribiendo") return;
    if (propiaRef.current === "hablando") callarVoz();
    sinProgreso.current = 0;
    vueltas.current = 0;
    void hablarYEscucharRef.current([]);
  }, []);

  // Al abrirse: el detector se descarga mientras la voz dice "No está
  // registrado. ¿Lo damos de alta?", y al terminar se escucha.
  useEffect(() => {
    vivo.current = true;
    if (!automatico) return () => void (vivo.current = false);
    precargarEscucha();
    let cancelado = false;
    void (async () => {
      await esperarQueCalle({ arranqueMs: 1200 });
      if (!cancelado && vivo.current) await hablarYEscucharRef.current([]);
    })();
    return () => {
      cancelado = true;
      vivo.current = false;
    };
    // Solo al abrir: prender la preferencia con el formulario abierto no lo dispara.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fase: FaseVoz = propia ?? escucha.estado;
  return { fase, dialogo, nivel: escucha.nivel, tocar };
}
