import { useCallback, useEffect, useRef, useState } from "react";
import type { MicVAD } from "@ricky0123/vad-web";

import { contextoAudio } from "@/shared/voz/audio";

/**
 * Escuchar sin botón: el micrófono se abre y es el navegador el que detecta
 * cuándo empieza y cuándo termina de hablar la persona (Silero VAD, un modelo
 * chico que corre en el navegador).
 *
 * Solo viaja al servidor lo que se habló: los segundos de espera y el ruido
 * de la tienda no salen del navegador y no cuestan nada. Y el corte lo da la
 * voz, no el volumen: con una radio de fondo, un detector por volumen no
 * corta nunca.
 */

export type EstadoEscucha =
  | "apagada"
  | "preparando"
  | "esperando"
  | "escuchando"
  | "sin-permiso"
  | "no-soportada";

/** Hasta cuánto esperar a que empiece a hablar. */
export const ESPERA_MS = 15_000;
/** Tope de una intervención. */
const TOPE_MS = 30_000;
/** Silencio que da por terminada la frase. */
const SILENCIO_MS = 2_000;

// El modelo y el motor salen del CDN con la versión exacta instalada: son
// 5 MB (comprimidos) que el navegador guarda un año y no inflan el panel.
const VERSION_VAD = "0.0.31";
const VERSION_ONNX = "1.30.0";

let instancia: Promise<MicVAD> | null = null;

/** Quién recibe los avisos del detector: hay uno solo para todo el panel. */
interface Oyente {
  inicio: () => void;
  fin: (audio: Float32Array) => void;
  falso: () => void;
  nivel: (n: number) => void;
}
let oyente: Oyente | null = null;

function cargar(): Promise<MicVAD> {
  instancia ??= import("@ricky0123/vad-web").then(({ MicVAD }) =>
    MicVAD.new({
      model: "v5",
      baseAssetPath: `https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@${VERSION_VAD}/dist/`,
      onnxWASMBasePath: `https://cdn.jsdelivr.net/npm/onnxruntime-web@${VERSION_ONNX}/dist/`,
      audioContext: contextoAudio() ?? undefined,
      startOnLoad: false,
      positiveSpeechThreshold: 0.6,
      negativeSpeechThreshold: 0.4,
      redemptionMs: SILENCIO_MS,
      // Lo dicho un poco antes de que el detector lo notara: sin esto se pierde
      // la primera sílaba ("…í, con cinco").
      preSpeechPadMs: 400,
      // Una tos o un golpe sobre el mostrador no son una frase.
      minSpeechMs: 300,
      // Al cortar por el tope, lo que se venía diciendo se entrega igual.
      submitUserSpeechOnPause: true,
      onSpeechStart: () => oyente?.inicio(),
      onSpeechEnd: (audio) => oyente?.fin(audio),
      onVADMisfire: () => oyente?.falso(),
      onFrameProcessed: (p) => oyente?.nivel(p.isSpeech),
    }),
  );
  instancia.catch(() => {
    // Si falló (sin red, navegador viejo), la próxima vez se reintenta.
    instancia = null;
  });
  return instancia;
}

/** Que el detector se descargue antes de que haga falta. */
export function precargarEscucha() {
  void cargar().catch(() => undefined);
}

export function escuchaSoportada(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof WebAssembly !== "undefined" &&
    typeof AudioContext !== "undefined"
  );
}

/** Float32 a 16 kHz → WAV de 16 bits: lo que entiende el servidor. */
async function aWav(audio: Float32Array): Promise<Blob> {
  const { utils } = await import("@ricky0123/vad-web");
  return new Blob([utils.encodeWAV(audio, 1, 16000, 1, 16)], { type: "audio/wav" });
}

export interface Escucha {
  estado: EstadoEscucha;
  /** 0 a 1, cuánto se parece a voz lo que entra. Ref: cambia 30 veces por segundo. */
  nivel: React.MutableRefObject<number>;
  /** Abre el micrófono y espera a que hable (hasta `esperaMs`). */
  escuchar: (esperaMs?: number) => Promise<void>;
  /** Cierra el micrófono sin entregar nada. */
  detener: () => void;
  /** Ya terminó de hablar (tocó el orbe): se entrega lo dicho sin esperar el silencio. */
  terminar: () => void;
}

/**
 * @param alHablar lo que se dijo, en WAV, cuando terminó de hablar.
 * @param alCallar pasó la espera y no habló nadie.
 */
export function useEscucha(alHablar: (wav: Blob) => void, alCallar: () => void): Escucha {
  const [estado, setEstado] = useState<EstadoEscucha>(escuchaSoportada() ? "apagada" : "no-soportada");
  const nivel = useRef(0);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tope = useRef<ReturnType<typeof setTimeout> | null>(null);
  const yo = useRef<Oyente | null>(null);
  const callbacks = useRef({ alHablar, alCallar });
  callbacks.current = { alHablar, alCallar };

  const limpiarRelojes = () => {
    if (espera.current) clearTimeout(espera.current);
    if (tope.current) clearTimeout(tope.current);
    espera.current = tope.current = null;
  };

  const soltar = useCallback(async (entregar: boolean) => {
    limpiarRelojes();
    nivel.current = 0;
    const propio = yo.current;
    if (!entregar && oyente === propio) oyente = null;
    yo.current = null;
    if (instancia) {
      const vad = await instancia.catch(() => null);
      // Pausar suelta el micrófono (el indicador del navegador se apaga).
      await vad?.pause();
    }
    if (oyente === propio) oyente = null;
  }, []);

  const detener = useCallback(() => {
    void soltar(false);
    setEstado((e) => (e === "sin-permiso" || e === "no-soportada" ? e : "apagada"));
  }, [soltar]);

  const terminar = useCallback(() => {
    // Pausar con `submitUserSpeechOnPause` entrega lo que se venía diciendo.
    void instancia?.then((v) => v.pause()).catch(() => undefined);
  }, []);

  const escuchar = useCallback(
    async (esperaMs = ESPERA_MS) => {
      if (!escuchaSoportada()) {
        setEstado("no-soportada");
        return;
      }
      limpiarRelojes();
      setEstado("preparando");

      const propio: Oyente = {
        inicio: () => {
          if (espera.current) clearTimeout(espera.current);
          espera.current = null;
          setEstado("escuchando");
          // Pasado el tope, se corta y se entrega lo dicho hasta ahí.
          tope.current = setTimeout(() => void instancia?.then((v) => v.pause()), TOPE_MS);
        },
        fin: (audio) => {
          void soltar(true);
          setEstado("apagada");
          void aWav(audio).then((wav) => callbacks.current.alHablar(wav));
        },
        // Un ruido corto: se sigue esperando.
        falso: () => setEstado("esperando"),
        nivel: (n) => {
          nivel.current = nivel.current * 0.6 + n * 0.4;
        },
      };
      yo.current = propio;
      oyente = propio;

      try {
        const vad = await cargar();
        if (yo.current !== propio) return; // se canceló mientras cargaba
        await vad.start();
        if (vad.errored) throw new Error(vad.errored);
        if (yo.current !== propio) {
          await vad.pause();
          return;
        }
        setEstado("esperando");
        espera.current = setTimeout(() => {
          void soltar(false);
          setEstado("apagada");
          callbacks.current.alCallar();
        }, esperaMs);
      } catch (e: any) {
        yo.current = null;
        if (oyente === propio) oyente = null;
        const sinPermiso = e?.name === "NotAllowedError" || /permission|denied/i.test(String(e?.message ?? e));
        // Una instancia que falló al abrir el micrófono ya no arranca: se descarta.
        instancia = null;
        setEstado(sinPermiso ? "sin-permiso" : "no-soportada");
      }
    },
    [soltar],
  );

  // Al cerrar el formulario, el micrófono se suelta sí o sí.
  useEffect(() => () => void soltar(false), [soltar]);

  return { estado, nivel, escuchar, detener, terminar };
}
