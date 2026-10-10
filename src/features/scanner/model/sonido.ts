/**
 * Los "bip" del escáner, generados con Web Audio: sin archivos que descargar.
 *
 * En un mostrador el sonido es la confirmación principal: quien escanea mira
 * el producto, no la pantalla. Cada resultado suena distinto para reconocerlo
 * sin mirar:
 *
 *   encontrado  un bip agudo y corto, como el de una caja de supermercado
 *   sugerido    dos notas que suben: "lo encontré afuera"
 *   nuevo       dos notas que bajan: "no lo conozco"
 *   creado      un arpegio corto: "listo"
 *   error       un zumbido grave
 *
 * Se puede apagar desde la hoja (queda guardado en el navegador).
 */

import { contextoAudio } from "@/shared/voz";

const CLAVE = "vendfy.escaner.sonido";

export type Sonido = "encontrado" | "sugerido" | "nuevo" | "creado" | "error";

const NOTAS: Record<Sonido, Array<[frecuencia: number, duracion: number, forma?: OscillatorType]>> = {
  encontrado: [[1760, 0.07, "square"]],
  sugerido: [
    [988, 0.07],
    [1319, 0.09],
  ],
  nuevo: [
    [784, 0.08],
    [587, 0.12],
  ],
  creado: [
    [1047, 0.06],
    [1319, 0.06],
    [1568, 0.12],
  ],
  error: [[196, 0.22, "sawtooth"]],
};

export function sonidoActivo(): boolean {
  try {
    return localStorage.getItem(CLAVE) !== "off";
  } catch {
    return true;
  }
}

export function setSonidoActivo(activo: boolean) {
  try {
    localStorage.setItem(CLAVE, activo ? "on" : "off");
  } catch {
    // sin almacenamiento, vale solo por esta sesión
  }
}

export function sonar(tipo: Sonido) {
  if (!sonidoActivo()) return;
  try {
    // El mismo contexto que la voz: se despierta con el primer gesto (la
    // tecla de la pistola cuenta).
    const contexto = contextoAudio();
    if (!contexto) return;
    let t = contexto.currentTime;
    for (const [frecuencia, duracion, forma = "sine"] of NOTAS[tipo]) {
      const osc = contexto.createOscillator();
      const gan = contexto.createGain();
      osc.type = forma;
      osc.frequency.value = frecuencia;
      // Volumen bajo y con caída suave: un clic seco cansa a la décima vez.
      gan.gain.setValueAtTime(0.0001, t);
      gan.gain.exponentialRampToValueAtTime(forma === "square" ? 0.05 : 0.12, t + 0.01);
      gan.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
      osc.connect(gan).connect(contexto.destination);
      osc.start(t);
      osc.stop(t + duracion + 0.02);
      t += duracion * 0.85;
    }
  } catch {
    // Sin audio (permisos, navegador viejo): el escáner funciona igual.
  }
}
