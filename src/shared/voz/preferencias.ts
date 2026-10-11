import { useSyncExternalStore } from "react";

/**
 * Lo que la persona eligió para la voz, en este navegador.
 *
 *   precios    decir el precio de lo que se escanea
 *   asistente  contestar hablando en el asistente
 *   voz        quién habla (id de Gemini: "Sulafat" es Sofía)
 */
export interface PreferenciasVoz {
  precios: boolean;
  asistente: boolean;
  voz: string;
}

export const VOZ_POR_DEFECTO = "Sulafat";

const CLAVE = "vendfy.voz";
/** Donde guardaba el asistente su "silenciar" antes de que existiera esto. */
const CLAVE_VIEJA_ASISTENTE = "vendfy.voz.respuestas";

function leer(): PreferenciasVoz {
  const base: PreferenciasVoz = { precios: true, asistente: true, voz: VOZ_POR_DEFECTO };
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado) return { ...base, ...JSON.parse(guardado) };
    if (localStorage.getItem(CLAVE_VIEJA_ASISTENTE) === "no") base.asistente = false;
  } catch {
    // sin almacenamiento: los valores por defecto
  }
  return base;
}

let actuales = leer();
const oyentes = new Set<() => void>();

export function preferenciasVoz(): PreferenciasVoz {
  return actuales;
}

export function setPreferenciasVoz(cambio: Partial<PreferenciasVoz>) {
  actuales = { ...actuales, ...cambio };
  try {
    localStorage.setItem(CLAVE, JSON.stringify(actuales));
  } catch {
    // dura la sesión
  }
  oyentes.forEach((f) => f());
}

function suscribir(f: () => void) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

export function usePreferenciasVoz(): PreferenciasVoz {
  return useSyncExternalStore(suscribir, preferenciasVoz, preferenciasVoz);
}
