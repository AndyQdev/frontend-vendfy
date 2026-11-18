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

/** El oído del teléfono: un servicio de Android que escucha aunque la pantalla esté apagada. */
export interface OidoNativo {
  /** `base`: de dónde bajar los modelos (los mismos del panel). */
  encender: (base: string, umbral: number) => void;
  apagar: () => void;
  pausar: (valor: boolean) => void;
}

/** Lo que el oído del teléfono le cuenta al panel (evento `vendfy-oido` en window). */
export type EventoOidoNativo =
  | { tipo: "palabra"; p: number }
  /** WAV 16 kHz en base64: desde 2 s antes de la palabra hasta que se calló. */
  | { tipo: "comando"; wav: string; hablo: boolean }
  /** `afuera`: lo apagaron con el «Apagar» de la notificación del teléfono. */
  | { tipo: "estado"; estado: "escuchando" | "apagado" | "error"; detalle?: string; afuera?: boolean };

export const EVENTO_OIDO = "vendfy-oido";

interface VendfyNativo {
  plataforma: "android" | "windows";
  traerAlFrente?: () => void;
  /** La app nativa avisa que el micrófono de fondo está prendido (servicio con notificación). */
  manosLibres?: (activo: boolean) => void;
  /** Si está, escucha el teléfono y el navegador no abre su micrófono. */
  oido?: OidoNativo;
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

/** El oído del teléfono, si el panel corre dentro de la app de Android que lo trae. */
export function oidoNativo(): OidoNativo | null {
  if (typeof window === "undefined") return null;
  return window.vendfyNativo?.oido ?? null;
}

/** A la app de Android: prender o apagar el micrófono de fondo junto con manos libres. */
export function avisarManosLibres(activo: boolean) {
  window.vendfyNativo?.manosLibres?.(activo);
}
