import { useCallback, useEffect, useRef, useState } from "react";

export type EstadoDictado =
  | "no-soportado"
  | "inactivo"
  | "pidiendo-permiso"
  | "grabando"
  | "procesando";

/**
 * Formatos que el navegador puede grabar, en orden de preferencia.
 *
 * Chrome y Edge graban webm/opus; Safari solo mp4. Sin esta lista, en Safari
 * `MediaRecorder` arranca con un formato que no soporta y falla al detener, que
 * es el peor momento posible: ya se dictó todo.
 */
const FORMATOS = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

/** 2 minutos. Un dictado de comercio dura segundos; esto es una red, no un uso. */
const TOPE_MS = 120_000;

/**
 * Menos que esto es un toque, no un dictado.
 *
 * Sin este corte, apretar y soltar sin querer manda medio segundo de silencio
 * al modelo — y los modelos de transcripción ALUCINAN sobre silencio: devuelven
 * una frase que nadie dijo. Es más barato y más confiable cortarlo acá.
 */
const MINIMO_MS = 400;

export interface Dictado {
  estado: EstadoDictado;
  /** 0 a 1. Para que se vea que está escuchando de verdad. */
  nivel: number;
  error: string | null;
  soportado: boolean;
  alternar: () => void;
  cancelar: () => void;
}

/**
 * Dictar al omnibox.
 *
 * Graba con `MediaRecorder` y entrega el audio; NO transcribe — de eso se
 * encarga el servidor, que es el único que conoce el catálogo de la tienda y
 * puede sesgar el reconocimiento hacia los nombres de los productos. El dictado
 * del navegador no acepta vocabulario, y por eso escucha "Guabirá" y escribe
 * cualquier cosa.
 *
 * Todo lo que se abre se cierra: las pistas del micrófono y el AudioContext se
 * liberan siempre, incluso si el componente se desmonta a mitad de la grabación.
 * Si no, el indicador de micrófono del navegador queda encendido y la persona
 * cree —con razón— que la seguimos escuchando.
 */
export function useDictado(alTerminar: (audio: Blob) => void): Dictado {
  const soportado =
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia);

  const [estado, setEstado] = useState<EstadoDictado>(
    soportado ? "inactivo" : "no-soportado",
  );
  const [nivel, setNivel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const grabador = useRef<MediaRecorder | null>(null);
  const pistas = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const animacion = useRef<number | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inicio = useRef(0);
  const cancelado = useRef(false);
  // El callback en una ref: si viniera de las dependencias, cambiar de función
  // en el padre reiniciaría la grabación en curso.
  const alTerminarRef = useRef(alTerminar);
  alTerminarRef.current = alTerminar;

  const limpiar = useCallback(() => {
    if (animacion.current) cancelAnimationFrame(animacion.current);
    if (temporizador.current) clearTimeout(temporizador.current);
    animacion.current = null;
    temporizador.current = null;

    pistas.current?.getTracks().forEach((t) => t.stop());
    pistas.current = null;

    audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;

    grabador.current = null;
    setNivel(0);
  }, []);

  // Desmontar a mitad de grabación tiene que soltar el micrófono igual.
  useEffect(() => limpiar, [limpiar]);

  const detener = useCallback(() => {
    if (grabador.current?.state === "recording") grabador.current.stop();
  }, []);

  const cancelar = useCallback(() => {
    cancelado.current = true;
    detener();
    setEstado("inactivo");
  }, [detener]);

  const arrancar = useCallback(async () => {
    setError(null);
    setEstado("pidiendo-permiso");
    cancelado.current = false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Un local con gente: sin esto el ruido de fondo se transcribe.
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (e: any) {
      setEstado("inactivo");
      setError(
        e?.name === "NotAllowedError"
          ? "No diste permiso para usar el micrófono. Habilitalo en el candado de la barra de direcciones."
          : e?.name === "NotFoundError"
            ? "No encontramos ningún micrófono conectado."
            : "No se pudo acceder al micrófono.",
      );
      return;
    }

    pistas.current = stream;

    const formato = FORMATOS.find((f) => MediaRecorder.isTypeSupported(f));
    if (!formato) {
      limpiar();
      setEstado("inactivo");
      setError("Tu navegador no puede grabar audio en un formato compatible.");
      return;
    }

    // Medidor de nivel: que se vea que está escuchando. Un botón que cambia de
    // color no distingue "grabando" de "colgado".
    try {
      const ctx = new AudioContext();
      audioCtx.current = ctx;
      const analizador = ctx.createAnalyser();
      analizador.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analizador);
      const datos = new Uint8Array(analizador.frequencyBinCount);

      const medir = () => {
        analizador.getByteTimeDomainData(datos);
        let pico = 0;
        for (const v of datos) pico = Math.max(pico, Math.abs(v - 128));
        setNivel(Math.min(1, pico / 64));
        animacion.current = requestAnimationFrame(medir);
      };
      medir();
    } catch {
      // Sin medidor se dicta igual: es ayuda visual, no el mecanismo.
    }

    const trozos: Blob[] = [];
    const rec = new MediaRecorder(stream, { mimeType: formato });
    grabador.current = rec;

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) trozos.push(e.data);
    };

    rec.onstop = () => {
      const duracion = Date.now() - inicio.current;
      const audio = new Blob(trozos, { type: formato });
      limpiar();

      if (cancelado.current) {
        setEstado("inactivo");
        return;
      }
      if (duracion < MINIMO_MS || audio.size < 2000) {
        setEstado("inactivo");
        setError("Mantené apretado un momento y hablá.");
        return;
      }

      setEstado("procesando");
      alTerminarRef.current(audio);
    };

    rec.onerror = () => {
      limpiar();
      setEstado("inactivo");
      setError("Se cortó la grabación.");
    };

    inicio.current = Date.now();
    // Trozos de 1 s: si algo se corta, no se pierde todo lo dictado.
    rec.start(1000);
    setEstado("grabando");
    temporizador.current = setTimeout(detener, TOPE_MS);
  }, [detener, limpiar]);

  const alternar = useCallback(() => {
    if (estado === "grabando") detener();
    else if (estado === "inactivo") void arrancar();
  }, [estado, detener, arrancar]);

  /** El padre avisa que ya terminó de procesar. */
  useEffect(() => {
    if (estado !== "procesando") return;
    // No hay nada que hacer acá: quien llamó decide cuándo vuelve a 'inactivo'
    // llamando a `cancelar`. Se deja explícito para que no parezca un olvido.
  }, [estado]);

  return { estado, nivel, error, soportado, alternar, cancelar };
}
