import { useSyncExternalStore } from "react";

const DISMISSED_KEY = "onboarding-checklist-dismissed";

const listeners = new Set<() => void>();

function getDismissed(): boolean {
  return localStorage.getItem(DISMISSED_KEY) === "1";
}

function setDismissed(value: boolean) {
  if (value) localStorage.setItem(DISMISSED_KEY, "1");
  else localStorage.removeItem(DISMISSED_KEY);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Hook compartido para leer/cambiar la visibilidad del checklist de onboarding.
 * Permite sincronizar el widget con un botón en el header sin contexto adicional.
 */
export function useOnboardingVisibility() {
  const dismissed = useSyncExternalStore(subscribe, getDismissed, () => false);
  return {
    dismissed,
    show: () => setDismissed(false),
    hide: () => setDismissed(true),
  };
}
