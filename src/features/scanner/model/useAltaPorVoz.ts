import { useCallback, useEffect, useRef, useState } from "react";

import {
  altaPorVoz,
  type CambiosAltaVoz,
  type FormularioAltaVoz,
} from "@/entities/product/api";
import { callarVoz, decirFrases, esperarQueCalle, preferenciasVoz } from "@/shared/voz";
import { PREGUNTAS_ALTA } from "./frases";
import { ESPERA_MS, precargarEscucha, useEscucha, type EstadoEscucha } from "./escucha";

/**
 * La conversación del alta por voz: escuchar, entender, rellenar y preguntar
 * lo que falta.
 *
 * Al abrirse el formulario la voz dice "No está registrado. ¿Lo damos de
 * alta?"; cuando termina, se abre el micrófono. Lo que se dice ("sí, a 25 y
 * tengo 5") vuelve como cambios de campos; si falta el precio o el nombre, lo
 * pregunta y vuelve a escuchar. Nunca registra: el botón sigue siendo del
 * comerciante.
 */

export type FaseVoz =
  | EstadoEscucha
  | "procesando"
  | "escribiendo"
  | "hablando"
  | "listo"
  | "sin-voz"
  | "error";

/** Después de completar, una ventana corta por si quiere corregir algo. */
const ESPERA_CORRECCION_MS = 8_000;
/** Cuántas veces se abre el micrófono solo, sin que nadie toque nada. */
const MAX_RONDAS = 4;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Opciones {
  /** La preferencia "Escuchar al dar de alta". Apagada: solo escucha si se toca el orbe. */
  automatico: boolean;
  storeId: string | null;
  /** Los valores de este momento (no los del render en que se creó la función). */
  formulario: () => FormularioAltaVoz;
  categorias: string[];
  cantidadEs: "stock" | "compra";
  /** Escribe los cambios en el formulario, con su efecto. */
  aplicar: (cambios: CambiosAltaVoz) => Promise<void>;
}

export function useAltaPorVoz({ automatico, storeId, formulario, categorias, cantidadEs, aplicar }: Opciones) {
  // Lo que la escucha no sabe: procesando, hablando, el ✓, el silencio, un error.
  const [propia, setPropia] = useState<FaseVoz | null>(null);
  const [oido, setOido] = useState<string | null>(null);
  // Lo que se le preguntó (se muestra aunque la voz esté apagada).
  const [pregunta, setPregunta] = useState<string | null>(null);
  const propiaRef = useRef(propia);
  propiaRef.current = propia;
  const vivo = useRef(true);
  const rondas = useRef(0);

  const datos = useRef({ storeId, formulario, categorias, cantidadEs, aplicar });
  datos.current = { storeId, formulario, categorias, cantidadEs, aplicar };

  // Las funciones se llaman entre sí; las refs evitan el ciclo de dependencias.
  const seguirRef = useRef<(pregunta: string | null, esperaMs?: number) => Promise<void>>(async () => {});

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
      setOido(dicho || null);
      const huboCambios = Object.keys(r.cambios).length > 0;
      if (huboCambios) {
        setPropia("escribiendo");
        await datos.current.aplicar(r.cambios);
        if (!vivo.current) return;
        setPropia("listo");
        await dormir(900);
        if (!vivo.current) return;
      }
      const ahora = datos.current.formulario();
      const pregunta = !ahora.nombre?.trim()
        ? PREGUNTAS_ALTA.nombre
        : !(ahora.precio && ahora.precio > 0)
          ? r.soloCosto
            ? PREGUNTAS_ALTA.precioTrasCosto
            : PREGUNTAS_ALTA.precio
          : null;
      if (pregunta) return void seguirRef.current(pregunta);
      // Habló pero no se entendió nada: que lo repita.
      if (!dicho) return void seguirRef.current(PREGUNTAS_ALTA.repetir);
      // Completo: una ventana corta para corregir, sin decir nada.
      return void seguirRef.current(null, ESPERA_CORRECCION_MS);
    } catch {
      if (vivo.current) setPropia("error");
    }
  }, []);

  const alCallar = useCallback(() => {
    setPropia("sin-voz");
    setTimeout(() => vivo.current && setPropia((f) => (f === "sin-voz" ? null : f)), 2200);
  }, []);

  const escucha = useEscucha(alHablar, alCallar);
  const escuchaRef = useRef(escucha);
  escuchaRef.current = escucha;

  seguirRef.current = async (pregunta, esperaMs = ESPERA_MS) => {
    if (!vivo.current) return;
    if (rondas.current >= MAX_RONDAS) {
      setPropia(null);
      return;
    }
    rondas.current++;
    setPregunta(pregunta);
    if (pregunta && preferenciasVoz().precios) {
      setPropia("hablando");
      decirFrases([{ tipo: "texto", texto: pregunta }]);
      // Recién cuando calla: si no, el micrófono graba la pregunta.
      await esperarQueCalle();
      if (!vivo.current) return;
    }
    setPropia(null);
    await escuchaRef.current.escuchar(esperaMs);
  };

  /** El orbe: empezar a escuchar, terminar de hablar o callar la pregunta. */
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
    if (propiaRef.current === "procesando") return;
    if (propiaRef.current === "hablando") callarVoz();
    rondas.current = 0;
    void seguirRef.current(null);
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
      if (!cancelado && vivo.current) await seguirRef.current(null);
    })();
    return () => {
      cancelado = true;
      vivo.current = false;
    };
    // Solo al abrir: prender la preferencia con el formulario abierto no lo dispara.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fase: FaseVoz = propia ?? escucha.estado;
  return { fase, oido, pregunta, nivel: escucha.nivel, tocar };
}
