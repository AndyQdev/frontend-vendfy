/**
 * El respaldo: la voz que trae el navegador, cuando la natural no llega a
 * tiempo (sin conexión, sin cupo). Se elige la mejor en español: las
 * "Natural" de Edge y las de Google suenan bastante mejor que las de
 * Windows, que eran las que salían antes por ser las primeras de la lista.
 */

const disponible = () => typeof window !== "undefined" && "speechSynthesis" in window;

let elegida: SpeechSynthesisVoice | null = null;
let escuchando = false;

function puntaje(v: SpeechSynthesisVoice): number {
  if (!/^es\b|^es[-_]/i.test(v.lang)) return -1;
  let p = 100;
  if (/natural|neural|online/i.test(v.name)) p += 50;
  else if (/google/i.test(v.name)) p += 30;
  if (/[-_](419|US|MX|BO|AR|CO|PE|CL|EC|UY|PY|VE)\b/i.test(v.lang)) p += 10;
  if (!v.localService) p += 5;
  return p;
}

function elegir() {
  const voces = window.speechSynthesis.getVoices();
  elegida = voces.filter((v) => puntaje(v) >= 0).sort((a, b) => puntaje(b) - puntaje(a))[0] ?? null;
}

export function vozDelNavegador(): SpeechSynthesisVoice | null {
  if (!disponible()) return null;
  if (!escuchando) {
    escuchando = true;
    // Las voces llegan tarde en algunos navegadores.
    window.speechSynthesis.addEventListener?.("voiceschanged", elegir);
  }
  if (!elegida) elegir();
  return elegida;
}

/** Dice el texto y resuelve cuando termina (o enseguida si no hay voz). */
export function decirConNavegador(texto: string, velocidad = 1.05): Promise<void> {
  if (!disponible() || !texto) return Promise.resolve();
  return new Promise((resolver) => {
    const u = new SpeechSynthesisUtterance(texto);
    const voz = vozDelNavegador();
    u.lang = voz?.lang ?? "es-419";
    if (voz) u.voice = voz;
    u.rate = Math.min(2, Math.max(1, velocidad));
    u.onend = () => resolver();
    u.onerror = () => resolver();
    window.speechSynthesis.speak(u);
  });
}

export function callarNavegador() {
  if (disponible()) window.speechSynthesis.cancel();
}
