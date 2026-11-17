/**
 * Lo que el panel puede pedirle a la app que lo envuelve (si la hay).
 *
 * - Windows (Tauri): `window.__TAURI__`. F9 desde cualquier programa llega
 *   como el evento "vendfy://atajo"; "traer_al_frente" muestra la ventana.
 * - Android (Expo): `window.vendfyNativo`, que inyecta la app (traer al frente
 *   y el aviso de manos libres viven en el servicio nativo).
 *
 * En el navegador no hay nada de esto y todo sigue funcionando igual.
 */

interface TauriGlobal {
  core: { invoke: (comando: string, args?: Record<string, unknown>) => Promise<unknown> };
  event: { listen: (evento: string, cb: (e: unknown) => void) => Promise<() => void> };
}

interface VendfyNativo {
  plataforma: "android" | "windows";
  traerAlFrente?: () => void;
  /** La app nativa avisa que el micrófono de fondo está prendido (servicio con notificación). */
  manosLibres?: (activo: boolean) => void;
}

declare global {
  interface Window {
    __TAURI__?: TauriGlobal;
    vendfyNativo?: VendfyNativo;
  }
}

export type Plataforma = "web" | "windows" | "android";

export function plataforma(): Plataforma {
  if (typeof window === "undefined") return "web";
  if (window.__TAURI__) return "windows";
  if (window.vendfyNativo?.plataforma === "android") return "android";
  return "web";
}

/** La ventana al frente (oyó "Oye Vendfy" con Vendfy minimizado o detrás de otro programa). */
export function traerAlFrente() {
  if (window.__TAURI__) {
    void window.__TAURI__.core.invoke("traer_al_frente").catch(() => undefined);
    return;
  }
  window.vendfyNativo?.traerAlFrente?.();
}

/** F9 desde cualquier programa (solo en la app de Windows). Devuelve cómo dejar de escuchar. */
export function alAtajoGlobal(cb: () => void): () => void {
  const tauri = window.__TAURI__;
  if (!tauri) return () => undefined;
  let quitar: () => void = () => undefined;
  let vivo = true;
  void tauri.event
    .listen("vendfy://atajo", () => cb())
    .then((f) => {
      if (vivo) quitar = f;
      else f();
    })
    .catch(() => undefined);
  return () => {
    vivo = false;
    quitar();
  };
}

/** A la app de Android: prender o apagar el micrófono de fondo junto con manos libres. */
export function avisarManosLibres(activo: boolean) {
  window.vendfyNativo?.manosLibres?.(activo);
}
