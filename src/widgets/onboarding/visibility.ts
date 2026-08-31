import { useSyncExternalStore } from "react";

/**
 * Si el panel de primeros pasos está abierto.
 *
 * Antes esto era al revés: el panel flotaba en la esquina desde el primer día
 * y había que cerrarlo, y el "cerrado" se guardaba en el navegador. Tapaba
 * contenido en cada pantalla y era lo primero que estorbaba.
 *
 * Ahora nace cerrado y solo lo abre un clic en el botón del header. Por eso
 * el estado vive en memoria y no en localStorage: no hay nada que recordar
 * entre visitas -si no lo abriste, no se ve- y recargar vuelve a dejar la
 * pantalla limpia.
 */
let abierto = false;

const listeners = new Set<() => void>();

function establecer(valor: boolean) {
  if (abierto === valor) return;
  abierto = valor;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Estado compartido entre el botón del header y el panel, sin necesidad de un
 * contexto: son dos puntos lejanos del árbol que hablan de lo mismo.
 */
export function useOnboardingVisibility() {
  const estaAbierto = useSyncExternalStore(
    subscribe,
    () => abierto,
    () => false,
  );

  return {
    abierto: estaAbierto,
    abrir: () => establecer(true),
    cerrar: () => establecer(false),
    alternar: () => establecer(!abierto),
  };
}
