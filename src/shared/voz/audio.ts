/**
 * Un solo AudioContext para todo el panel (bips del escáner y voz).
 *
 * El navegador no deja que suene nada hasta que la persona toca o teclea
 * algo: se crea y se despierta en el primer gesto, así cuando llega el
 * precio (después de ir a buscarlo) ya puede sonar. La tecla de la pistola
 * cuenta como gesto.
 */

let contexto: AudioContext | null = null;
let preparado = false;

type ConstructorAudio = typeof AudioContext;

function crear(): AudioContext | null {
  if (contexto) return contexto;
  try {
    const Ctor: ConstructorAudio | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: ConstructorAudio }).webkitAudioContext;
    contexto = Ctor ? new Ctor() : null;
  } catch {
    contexto = null;
  }
  return contexto;
}

/** El contexto, despierto si se puede. Null si el navegador no tiene audio. */
export function contextoAudio(): AudioContext | null {
  const ctx = crear();
  if (ctx && ctx.state !== "running") void ctx.resume().catch(() => undefined);
  return ctx;
}

/** El contexto si ya existe, sin crearlo ni despertarlo (para leer la hora 60 veces por segundo). */
export function audioActual(): AudioContext | null {
  return contexto;
}

/** Engancha el despertar al primer gesto. Se llama una vez al montar el panel. */
export function prepararAudio() {
  if (preparado || typeof window === "undefined") return;
  preparado = true;
  const despertar = () => {
    const ctx = crear();
    if (ctx && ctx.state !== "running") void ctx.resume().catch(() => undefined);
  };
  // Se queda escuchando: iOS lo vuelve a dormir al pasar a segundo plano.
  window.addEventListener("pointerdown", despertar, { capture: true, passive: true });
  window.addEventListener("keydown", despertar, { capture: true, passive: true });
}
