/**
 * Lo que se dice después de "Oye Vendfy": se junta hasta que la persona se
 * calla, con el mismo micrófono y sin cortes (la frase de corrido "Oye Vendfy
 * vende dos cocas" no pierde el "vende").
 *
 * Voz o silencio por energía, contra el piso de ruido del lugar (medido antes
 * de la palabra): en una tienda con música el silencio no es cero.
 */

export const PASO_SEG = 0.08;

const seg = (s: number) => Math.round(s / PASO_SEG);

export interface OpcionesComando {
  /** Si no empieza a hablar en este tiempo, se manda solo la palabra ("¿Sí? Dime."). */
  esperaInicio?: number;
  /** Silencio que da por terminada la frase. */
  silencioFinal?: number;
  /** Tope de la frase. */
  maximo?: number;
}

export function rms(x: Float32Array): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, x.length));
}

/** El piso de ruido: un percentil bajo de la energía de los últimos segundos. */
export class PisoDeRuido {
  private valores: number[] = [];
  constructor(private readonly largo = seg(4)) {}
  empujar(energia: number) {
    this.valores.push(energia);
    if (this.valores.length > this.largo) this.valores.shift();
  }
  valor(): number {
    if (!this.valores.length) return 0.002;
    const orden = [...this.valores].sort((a, b) => a - b);
    return orden[Math.floor(orden.length * 0.2)];
  }
}

export class Comando {
  private readonly pasos: Float32Array[] = [];
  private conVoz = 0;
  private silencio = 0;
  private readonly umbral: number;
  private readonly esperaInicio: number;
  private readonly silencioFinal: number;
  private readonly maximo: number;

  constructor(piso: number, o: OpcionesComando = {}) {
    // Voz = bastante por encima del ruido del lugar (≈ −48 dBFS como mínimo).
    this.umbral = Math.max(piso * 3, 0.004);
    this.esperaInicio = seg(o.esperaInicio ?? 6);
    this.silencioFinal = seg(o.silencioFinal ?? 1.0);
    this.maximo = seg(o.maximo ?? 10);
  }

  /** true cuando ya terminó (se calló, no habló o llegó al tope). */
  empujar(paso: Float32Array): boolean {
    this.pasos.push(paso);
    if (rms(paso) >= this.umbral) {
      this.conVoz++;
      this.silencio = 0;
    } else {
      this.silencio++;
    }
    if (this.pasos.length >= this.maximo) return true;
    if (this.conVoz < seg(0.3)) return this.pasos.length >= this.esperaInicio;
    return this.silencio >= this.silencioFinal;
  }

  /** ¿Dijo algo después de la palabra? */
  get hablo(): boolean {
    return this.conVoz >= seg(0.3);
  }

  /** Lo dicho, sin el silencio del final. */
  audio(): Float32Array[] {
    return this.hablo ? this.pasos.slice(0, this.pasos.length - Math.max(0, this.silencio - seg(0.3))) : [];
  }
}

/** WAV de 16 bits a 16 kHz: lo que entiende el servidor. */
export function aWav(trozos: Float32Array[], frecuencia = 16000): ArrayBuffer {
  const n = trozos.reduce((s, t) => s + t.length, 0);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const texto = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  texto(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  texto(8, "WAVE");
  texto(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, frecuencia, true);
  v.setUint32(28, frecuencia * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  texto(36, "data");
  v.setUint32(40, n * 2, true);
  let o = 44;
  for (const t of trozos) {
    for (let i = 0; i < t.length; i++, o += 2) v.setInt16(o, Math.max(-1, Math.min(1, t[i])) * 32767, true);
  }
  return buf;
}
