/**
 * Hablar más rápido sin voz de ardilla.
 *
 * Subir el `playbackRate` de Web Audio acelera, pero también sube el tono.
 * Esto es WSOLA: se recorta la voz en ventanas cortas que se vuelven a pegar
 * más juntas, y cada una se corre unos milisegundos hasta que su onda calce
 * con la anterior. Así sale más rápida y con el mismo tono.
 *
 * Funciona por trozos: el audio que llega del servidor mientras se genera se
 * acelera a medida que llega, sin esperar al final.
 */

/** Largo de cada ventana: lo bastante para varias ondas de la voz. */
const VENTANA_MS = 30;
/** Cuánto puede correrse una ventana para calzar: un período de voz grave. */
const TOLERANCIA_MS = 10;
/**
 * El calce se mide salteando muestras (como si fuera audio a 12 kHz, donde
 * sigue estando toda la voz): sobra precisión y es varias veces más rápido.
 */
const FRECUENCIA_CALCE = 12_000;

export class Acelerador {
  private readonly n: number;
  private readonly hs: number;
  private readonly ha: number;
  private readonly tol: number;
  private readonly paso: number;
  private readonly ventana: Float32Array;
  /** Entrada pendiente; `base` es la posición absoluta de su primera muestra. */
  private ent = new Float32Array(0);
  private base = 0;
  private total = 0;
  private k = 0;
  private previo = 0;
  /** La salida que todavía se está superponiendo con la ventana siguiente. */
  private cola: Float32Array;

  constructor(frecuencia: number, readonly factor: number) {
    this.hs = Math.max(8, Math.round((frecuencia * VENTANA_MS) / 2000));
    this.n = this.hs * 2;
    this.ha = this.hs * factor;
    this.tol = Math.round((frecuencia * TOLERANCIA_MS) / 1000);
    this.paso = Math.max(1, Math.round(frecuencia / FRECUENCIA_CALCE));
    this.ventana = new Float32Array(this.n);
    // Hann periódica: dos mitades superpuestas suman exactamente 1.
    for (let i = 0; i < this.n; i++) this.ventana[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / this.n);
    this.cola = new Float32Array(this.n);
  }

  /** Suma muestras y devuelve lo que ya se puede escuchar (puede venir vacío). */
  push(muestras: Float32Array): Float32Array {
    const unidas = new Float32Array(this.ent.length + muestras.length);
    unidas.set(this.ent);
    unidas.set(muestras, this.ent.length);
    this.ent = unidas;
    this.total += muestras.length;
    return this.procesar(false);
  }

  /** Lo que queda, cuando ya no llega más audio. */
  flush(): Float32Array {
    return this.procesar(true);
  }

  /**
   * Dónde arranca la ventana k: cerca de su lugar ideal, donde mejor calza con
   * la anterior. Lee `ent` directo (sin funciones por muestra): es el bucle
   * caliente; `procesar` garantiza que todo lo leído está dentro.
   */
  private buscar(ideal: number): number {
    if (this.k === 0) return Math.max(0, ideal);
    const x = this.ent;
    const natural = this.previo + this.hs - this.base;
    const largo = this.hs;
    const paso = this.paso;
    const desde = Math.max(0, ideal - this.tol - this.base);
    const hasta = ideal + this.tol - this.base;
    const medir = (c: number) => {
      let cruce = 0;
      let energia = 1e-9;
      for (let j = 0; j < largo; j += paso) {
        const a = x[c + j];
        cruce += a * x[natural + j];
        energia += a * a;
      }
      return cruce / Math.sqrt(energia);
    };
    let mejor = desde;
    let mejorValor = -Infinity;
    for (let c = desde; c <= hasta; c += paso) {
      const v = medir(c);
      if (v > mejorValor) {
        mejorValor = v;
        mejor = c;
      }
    }
    // Afinar alrededor del mejor.
    const gruesa = mejor;
    for (let c = Math.max(desde, gruesa - paso + 1); c < Math.min(hasta + 1, gruesa + paso); c++) {
      if (c === gruesa) continue;
      const v = medir(c);
      if (v > mejorValor) {
        mejorValor = v;
        mejor = c;
      }
    }
    return mejor + this.base;
  }

  private procesar(final: boolean): Float32Array {
    const salida: Float32Array[] = [];
    let largo = 0;
    if (final) {
      // Silencio al final, para que las últimas ventanas lean dentro.
      const relleno = new Float32Array(this.ent.length + this.n * 2 + this.tol * 2 + Math.ceil(this.ha));
      relleno.set(this.ent);
      this.ent = relleno;
    }
    for (;;) {
      const ideal = Math.round(this.k * this.ha);
      if (final ? ideal >= this.total : Math.max(ideal + this.tol, this.previo + this.hs) + this.n > this.total) break;
      const inicio = this.buscar(ideal);
      for (let i = 0; i < this.n; i++) {
        // La primera ventana entra entera, sin fundido de entrada.
        const w = this.k === 0 && i < this.hs ? 1 : this.ventana[i];
        this.cola[i] += this.ent[inicio - this.base + i] * w;
      }
      const lista = this.cola.slice(0, this.hs);
      salida.push(lista);
      largo += lista.length;
      this.cola.copyWithin(0, this.hs);
      this.cola.fill(0, this.n - this.hs);
      this.previo = inicio;
      this.k++;
      // Lo que ya no se va a volver a leer se descarta.
      const necesario = Math.min(Math.round(this.k * this.ha) - this.tol, this.previo + this.hs);
      if (necesario > this.base) {
        this.ent = this.ent.slice(Math.min(this.ent.length, necesario - this.base));
        this.base = necesario;
      }
    }
    if (final) {
      const resto = this.cola.slice(0, this.hs);
      salida.push(resto);
      largo += resto.length;
      this.cola.fill(0);
    }
    const out = new Float32Array(largo);
    let desde = 0;
    for (const s of salida) {
      out.set(s, desde);
      desde += s.length;
    }
    return out;
  }
}

/** Acelera un audio entero. */
export function acelerarMuestras(muestras: Float32Array, frecuencia: number, factor: number): Float32Array {
  if (Math.abs(factor - 1) < 0.01 || muestras.length < frecuencia * 0.05) return muestras;
  const a = new Acelerador(frecuencia, factor);
  const cuerpo = a.push(muestras);
  const cola = a.flush();
  const out = new Float32Array(cuerpo.length + cola.length);
  out.set(cuerpo);
  out.set(cola, cuerpo.length);
  return out;
}
