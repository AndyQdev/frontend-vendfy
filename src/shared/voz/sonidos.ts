import { contextoAudio } from "./audio";

/**
 * Los sonidos de Vendfy cuando se abre y se cierra, hechos con osciladores
 * (sin archivos que bajar). Una campana suave: cada nota lleva su octava y su
 * quinta bajitas, ataque corto sin "clic" y una cola que se apaga sola.
 */

interface Nota {
  /** Frecuencia en Hz. */
  f: number;
  /** Cuándo empieza, en segundos desde ahora. */
  en: number;
  /** Cuánto dura la cola. */
  dura: number;
  volumen: number;
}

const ARMONICOS: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [2, 0.22],
  [3, 0.06],
];

function tocar(notas: Nota[]) {
  const ctx = contextoAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.01;
  // Un pasa bajos le saca lo metálico; va directo a la salida (la bola no late con esto).
  const filtro = ctx.createBiquadFilter();
  filtro.type = "lowpass";
  filtro.frequency.value = 4200;
  filtro.connect(ctx.destination);
  for (const n of notas) {
    const inicio = t0 + n.en;
    for (const [mult, peso] of ARMONICOS) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = n.f * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, inicio);
      g.gain.linearRampToValueAtTime(n.volumen * peso, inicio + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, inicio + n.dura);
      osc.connect(g).connect(filtro);
      osc.start(inicio);
      osc.stop(inicio + n.dura + 0.05);
    }
  }
}

/** Al abrirse para escuchar: dos notas que suben (mi → si). */
export function sonarActivacion() {
  tocar([
    { f: 659.25, en: 0, dura: 0.3, volumen: 0.1 },
    { f: 987.77, en: 0.09, dura: 0.45, volumen: 0.11 },
  ]);
}

/** Al cerrarse: las mismas, bajando y más suaves. */
export function sonarCierre() {
  tocar([
    { f: 880, en: 0, dura: 0.22, volumen: 0.06 },
    { f: 587.33, en: 0.08, dura: 0.34, volumen: 0.055 },
  ]);
}

/** Vuelve a escuchar después de preguntar: un toque corto, para saber que ya puedes hablar. */
export function sonarTurno() {
  tocar([{ f: 1318.5, en: 0, dura: 0.18, volumen: 0.045 }]);
}
