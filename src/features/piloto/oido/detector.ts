/**
 * El detector de "Oye Vendfy": la misma cuenta que openWakeWord, cada 80 ms.
 *
 *   audio (1280 muestras) → espectrograma mel (8 cuadros × 32) → embedding de
 *   los últimos 76 cuadros (96 valores) → clasificador sobre los últimos 16
 *   embeddings (1,28 s) → probabilidad de que se acabe de decir la palabra.
 *
 * Los modelos los corre quien lo use (`Ejecutor`): en el panel, onnxruntime-web
 * dentro de un worker; en las pruebas, lo mismo desde la página. Así esta
 * cuenta se compara 1 a 1 con la de Python con la que se entrenó.
 */

export interface Ejecutor {
  /** Espectrograma mel de `n` muestras (escala int16): `cuadros × 32` valores, sin transformar. */
  mel(muestras: Float32Array): Promise<Float32Array>;
  /** Embedding de 76 cuadros × 32 (ya transformados): 96 valores. */
  embedding(ventana: Float32Array): Promise<Float32Array>;
  /** Probabilidad de la palabra con los últimos 16 embeddings (16 × 96). */
  clasificar(caracteristicas: Float32Array): Promise<number>;
}

export const MUESTRAS_POR_PASO = 1280; // 80 ms a 16 kHz
const CONTEXTO = 480; // 3 saltos de 10 ms antes del paso (como openWakeWord)
const CUADROS_EMBEDDING = 76;
const MAX_CUADROS = 970;
const EMBEDDINGS = 16;
const MAX_EMBEDDINGS = 120;

export class DetectorPalabra {
  private crudo = new Float32Array(0);
  private mel: Float32Array[] = [];
  private embeddings: Float32Array[] = [];

  constructor(private readonly ejecutor: Ejecutor) {
    this.reiniciar();
  }

  reiniciar() {
    this.crudo = new Float32Array(0);
    // openWakeWord arranca el espectrograma con unos: se hace igual.
    this.mel = Array.from({ length: CUADROS_EMBEDDING }, () => new Float32Array(32).fill(1));
    this.embeddings = [];
  }

  /**
   * Un paso de 80 ms. `paso` en escala int16 (−32768…32767), como lo recibe el
   * modelo. Devuelve la probabilidad, o null mientras no hay 1,28 s de historia.
   */
  async procesar(paso: Float32Array): Promise<number | null> {
    if (paso.length !== MUESTRAS_POR_PASO) throw new Error(`Se esperaban ${MUESTRAS_POR_PASO} muestras`);
    const unido = new Float32Array(this.crudo.length + paso.length);
    unido.set(this.crudo);
    unido.set(paso, this.crudo.length);
    const entrada = unido.slice(-(MUESTRAS_POR_PASO + CONTEXTO));
    this.crudo = entrada;

    const espectro = await this.ejecutor.mel(entrada);
    for (let i = 0; i + 32 <= espectro.length; i += 32) {
      const fila = new Float32Array(32);
      for (let j = 0; j < 32; j++) fila[j] = espectro[i + j] / 10 + 2;
      this.mel.push(fila);
    }
    if (this.mel.length > MAX_CUADROS) this.mel.splice(0, this.mel.length - MAX_CUADROS);

    const ventana = new Float32Array(CUADROS_EMBEDDING * 32);
    const desde = this.mel.length - CUADROS_EMBEDDING;
    for (let i = 0; i < CUADROS_EMBEDDING; i++) ventana.set(this.mel[desde + i], i * 32);
    this.embeddings.push(await this.ejecutor.embedding(ventana));
    if (this.embeddings.length > MAX_EMBEDDINGS) this.embeddings.splice(0, this.embeddings.length - MAX_EMBEDDINGS);
    if (this.embeddings.length < EMBEDDINGS) return null;

    const x = new Float32Array(EMBEDDINGS * 96);
    const inicio = this.embeddings.length - EMBEDDINGS;
    for (let i = 0; i < EMBEDDINGS; i++) x.set(this.embeddings[inicio + i], i * 96);
    return this.ejecutor.clasificar(x);
  }
}

/**
 * Cuándo se da por dicha: `paciencia` pasos seguidos sobre el umbral, y
 * después un descanso (no dispara dos veces por la misma palabra).
 */
export class Disparador {
  private seguidos = 0;
  private descanso = 0;

  constructor(
    public umbral: number,
    private readonly paciencia = 2,
    private readonly descansoPasos = 25, // 2 s
  ) {}

  /** true en el paso en que se da por dicha. */
  empujar(p: number | null): boolean {
    if (this.descanso > 0) {
      this.descanso--;
      this.seguidos = 0;
      return false;
    }
    if (p == null || p < this.umbral) {
      this.seguidos = 0;
      return false;
    }
    if (++this.seguidos >= this.paciencia) {
      this.seguidos = 0;
      this.descanso = this.descansoPasos;
      return true;
    }
    return false;
  }

  reiniciar() {
    this.seguidos = 0;
    this.descanso = 0;
  }
}
