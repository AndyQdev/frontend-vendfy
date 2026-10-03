import { useSyncExternalStore } from "react";

/**
 * El estado de "se puede instalar", compartido por toda la app.
 *
 * `beforeinstallprompt` es un evento de UN SOLO USO y llega ANTES de que monte
 * React, así que no puede vivir en un useState por componente: el primero que
 * lo consuma deja a los demás con un evento gastado y su botón deja de hacer
 * nada. Lo captura un script en línea del <head> (ver index.html) y lo guarda
 * en `window.__vendfyInstall`; acá solo se lee y se avisa a quien escuche.
 */

interface PromptInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface Buzon {
  evento: PromptInstalacion | null;
  oyentes: Set<() => void>;
}

function buzon(): Buzon | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { __vendfyInstall?: Buzon }).__vendfyInstall ?? null;
}

function avisar() {
  buzon()?.oyentes.forEach((f) => f());
}

function suscribir(alCambiar: () => void) {
  const b = buzon();
  if (!b) return () => {};
  b.oyentes.add(alCambiar);
  return () => {
    b.oyentes.delete(alCambiar);
  };
}

// Devuelve un booleano, no un objeto: useSyncExternalStore compara por
// identidad y un objeto nuevo en cada lectura provoca un bucle de renders.
function leer() {
  return Boolean(buzon()?.evento);
}

/** Ya corre instalada, sea por el manifiesto o agregada a inicio en iOS. */
export function estaInstalada(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * iPhone y iPad nunca disparan `beforeinstallprompt`: ahí la instalación es a
 * mano desde Compartir, así que hay que explicarla en vez de ofrecer un botón.
 * El iPad con iPadOS 13+ se presenta como Mac; se lo distingue por el táctil.
 */
export function esIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const iPadNuevo = /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/i.test(ua) || iPadNuevo;
}

/**
 * Abre el diálogo del navegador. Devuelve si la persona aceptó.
 *
 * El evento se descarta pase lo que pase: ya se consumió y volver a usarlo
 * lanza. Si lo rechaza, el navegador ofrecerá otro más adelante.
 */
export async function instalar(): Promise<boolean> {
  const b = buzon();
  const evento = b?.evento;
  if (!b || !evento) return false;

  b.evento = null;
  avisar();

  try {
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    return outcome === "accepted";
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────── el aviso discreto en móvil

const CLAVE_POSPUESTO = "vendfy_instalacion_pospuesta";
const SIETE_DIAS = 7 * 24 * 60 * 60 * 1000;

/** "Ahora no" calla el aviso una semana; el botón del menú sigue estando. */
export function posponerAviso() {
  try {
    localStorage.setItem(CLAVE_POSPUESTO, String(Date.now()));
  } catch {
    // Navegador sin almacenamiento: el aviso vuelve a aparecer y ya.
  }
}

export function avisoPospuesto(): boolean {
  try {
    const guardado = Number(localStorage.getItem(CLAVE_POSPUESTO));
    return Boolean(guardado) && Date.now() - guardado < SIETE_DIAS;
  } catch {
    return false;
  }
}

/** `puedeInstalar` es reactivo; el resto no cambia durante la sesión. */
export function useInstalacion() {
  const puedeInstalar = useSyncExternalStore(suscribir, leer, () => false);
  return {
    puedeInstalar,
    instalada: estaInstalada(),
    ios: esIOS(),
    instalar,
  };
}
