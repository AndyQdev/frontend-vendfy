import type { AlOido, DelOido } from "./mensajes";

/**
 * El micrófono siempre abierto para "Oye Vendfy" (modo manos libres).
 *
 * Captura a 16 kHz con un AudioWorklet y le pasa al worker pasos de 80 ms. El
 * worker decide; acá solo llegan tres cosas: "oyó la palabra", "esto es lo que
 * dijo después" y, para mostrar, el puntaje.
 *
 * Si el panel corre dentro de la app de escritorio o de Android y esa app
 * escucha por su cuenta (window.vendfyNativo), el navegador no abre su micrófono.
 */

/** Umbral del detector: lo fija el entrenamiento (modelo/metricas.json). */
export const UMBRAL_POR_DEFECTO = 0.5;
export const BASE_MODELOS = "/oido/";

export type EstadoOido = "apagado" | "cargando" | "escuchando" | "sin-permiso" | "error";

export interface EventosOido {
  palabra?: (p: number) => void;
  comando?: (wav: Blob, hablo: boolean) => void;
  puntaje?: (p: number) => void;
  estado?: (e: EstadoOido, detalle?: string) => void;
  /** Lo apagaron desde afuera (el «Apagar» de la notificación del teléfono). */
  apagadoAfuera?: () => void;
}

/** Lo que el panel le pide a cualquier oído (el del navegador o el del teléfono). */
export interface ControlOido {
  readonly estado: EstadoOido;
  encender(): Promise<void>;
  pausar(valor: boolean): void;
  setUmbral(valor: number): void;
  apagar(): void;
  destruir(): void;
}

/** Junta el micrófono en pasos de 1280 muestras a 16 kHz (si el contexto no es de 16 kHz, promedia). */
const WORKLET = `
class CapturaVendfy extends AudioWorkletProcessor {
  constructor() {
    super();
    this.paso = new Float32Array(1280);
    this.n = 0;
    this.razon = sampleRate / 16000;
    this.suma = 0;
    this.cuenta = 0;
    this.posicion = 0;
  }
  empujar(v) {
    this.paso[this.n++] = v;
    if (this.n === 1280) {
      this.port.postMessage(this.paso, [this.paso.buffer]);
      this.paso = new Float32Array(1280);
      this.n = 0;
    }
  }
  process(inputs) {
    const canal = inputs[0] && inputs[0][0];
    if (!canal) return true;
    if (this.razon === 1) {
      for (let i = 0; i < canal.length; i++) this.empujar(canal[i]);
      return true;
    }
    for (let i = 0; i < canal.length; i++) {
      this.suma += canal[i];
      this.cuenta++;
      this.posicion += 1;
      if (this.posicion >= this.razon) {
        this.posicion -= this.razon;
        this.empujar(this.suma / this.cuenta);
        this.suma = 0;
        this.cuenta = 0;
      }
    }
    return true;
  }
}
registerProcessor("captura-vendfy", CapturaVendfy);
`;

export class Oido implements ControlOido {
  private worker: Worker | null = null;
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private nodo: AudioWorkletNode | null = null;
  private listo: Promise<void> | null = null;
  estado: EstadoOido = "apagado";

  constructor(
    private readonly eventos: EventosOido,
    private readonly opciones: { base?: string; umbral?: number; paciencia?: number } = {},
  ) {}

  private cambiar(e: EstadoOido, detalle?: string) {
    this.estado = e;
    this.eventos.estado?.(e, detalle);
  }

  private mandar(m: AlOido, transferir: Transferable[] = []) {
    this.worker?.postMessage(m, transferir);
  }

  private iniciarWorker(): Promise<void> {
    if (this.listo) return this.listo;
    this.worker = new Worker(new URL("./oido.worker.ts", import.meta.url), { type: "module" });
    this.listo = new Promise((resolve, reject) => {
      this.worker!.onmessage = (e: MessageEvent<DelOido>) => {
        const m = e.data;
        if (m.tipo === "listo") resolve();
        else if (m.tipo === "error") {
          reject(new Error(m.mensaje));
          this.cambiar("error", m.mensaje);
        } else if (m.tipo === "puntaje") this.eventos.puntaje?.(m.p);
        else if (m.tipo === "palabra") this.eventos.palabra?.(m.p);
        else if (m.tipo === "comando") this.eventos.comando?.(new Blob([m.wav], { type: "audio/wav" }), m.hablo);
      };
    });
    this.mandar({
      tipo: "iniciar",
      base: this.opciones.base ?? BASE_MODELOS,
      umbral: this.opciones.umbral ?? UMBRAL_POR_DEFECTO,
      paciencia: this.opciones.paciencia ?? 2,
    });
    return this.listo;
  }

  async encender(): Promise<void> {
    if (this.estado === "escuchando" || this.estado === "cargando") return;
    this.cambiar("cargando");
    try {
      await this.iniciarWorker();
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (error) {
      const sinPermiso = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
      this.cambiar(sinPermiso ? "sin-permiso" : "error", error instanceof Error ? error.message : String(error));
      this.liberarMicrofono();
      return;
    }
    try {
      this.ctx = new AudioContext({ sampleRate: 16000 });
    } catch {
      // Algún navegador no deja elegir la frecuencia: se promedia en el worklet.
      this.ctx = new AudioContext();
    }
    const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
    await this.ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const fuente = this.ctx.createMediaStreamSource(this.stream);
    this.nodo = new AudioWorkletNode(this.ctx, "captura-vendfy", { numberOfInputs: 1, numberOfOutputs: 0 });
    this.nodo.port.onmessage = (e: MessageEvent<Float32Array>) => this.mandar({ tipo: "audio", paso: e.data }, [e.data.buffer]);
    fuente.connect(this.nodo);
    if (this.ctx.state === "suspended") await this.ctx.resume().catch(() => undefined);
    this.cambiar("escuchando");
  }

  /** Mientras habla Vendfy o se está cobrando, no se toma "Oye Vendfy" como pedido nuevo. */
  pausar(valor: boolean) {
    this.mandar({ tipo: "pausa", valor });
  }

  setUmbral(valor: number) {
    this.mandar({ tipo: "umbral", valor });
  }

  private liberarMicrofono() {
    this.nodo?.disconnect();
    this.nodo = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }

  apagar() {
    this.liberarMicrofono();
    this.cambiar("apagado");
  }

  destruir() {
    this.apagar();
    this.worker?.terminate();
    this.worker = null;
    this.listo = null;
  }
}
