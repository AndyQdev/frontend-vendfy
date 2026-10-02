import fs from "node:fs";

import type { Page } from "@playwright/test";

import type { TablaVista } from "../../src/entities/omnibox/model/types";
import { paginaSandbox } from "../../src/features/omnibox/model/sandbox";

/**
 * Una herramienta a medida (G6) corriendo en su iframe aislado, sin el resto
 * de la app: para probar el AISLAMIENTO en sí (que el código de adentro no
 * pueda salir) y para el banco de experimentos con el modelo de verdad.
 *
 * La página de afuera se sirve en el mismo origen que la app y hace lo mismo
 * que SandboxHerramienta: espera "preparada", manda las librerías, el código
 * y los datos, ajusta la altura y anota cada mensaje en `window.__mensajes`.
 */

/** Las librerías del iframe, como las arma `npm run dev` (scripts/sandbox-libs.mjs). */
let librerias: string | null = null;
const leerLibrerias = () => (librerias ??= fs.readFileSync("public/sandbox/librerias.js", "utf8"));

export interface MensajeAnotado {
  tipo: string;
  [k: string]: unknown;
}

const ANFITRION = `<!doctype html><html><head><meta charset="utf-8"></head>
<body style="margin:0"><iframe id="herramienta" title="Herramienta" sandbox="allow-scripts" style="display:block;width:100%;height:120px;border:0"></iframe></body></html>`;

export async function montarHerramienta(
  page: Page,
  { codigo, datos, tema = "claro" }: { codigo: string; datos: Record<string, TablaVista>; tema?: "claro" | "oscuro" },
): Promise<void> {
  await page.route("**/__anfitrion", (r) => r.fulfill({ contentType: "text/html; charset=utf-8", body: ANFITRION }));
  await page.goto("/__anfitrion");
  const srcdoc = paginaSandbox({ tema });
  await page.evaluate(
    ({ srcdoc, codigo, datos, librerias }) => {
      const w = window as unknown as { __mensajes: unknown[] };
      w.__mensajes = [];
      const marco = document.getElementById("herramienta") as HTMLIFrameElement;
      window.addEventListener("message", (ev) => {
        if (ev.source !== marco.contentWindow) return;
        const d = ev.data as { vendfy?: boolean; tipo?: string; alto?: number } | null;
        if (!d || d.vendfy !== true) return;
        w.__mensajes.push(d);
        if (d.tipo === "preparada") marco.contentWindow!.postMessage({ tipo: "cargar", librerias, codigo, datos }, "*");
        if (d.tipo === "altura" && typeof d.alto === "number") marco.style.height = `${d.alto}px`;
      });
      marco.srcdoc = srcdoc;
    },
    { srcdoc, codigo, datos, librerias: leerLibrerias() },
  );
}

export const mensajes = (page: Page) =>
  page.evaluate(() => (window as unknown as { __mensajes: MensajeAnotado[] }).__mensajes ?? []);

/** Espera a que la herramienta se dibuje o falle. "tiempo" si no dijo nada (las librerías no cargaron). */
export async function esperarHerramienta(page: Page, ms = 15_000): Promise<"lista" | "error" | "tiempo"> {
  try {
    await page.waitForFunction(
      () => ((window as unknown as { __mensajes?: MensajeAnotado[] }).__mensajes ?? []).some((m) => m.tipo === "lista" || m.tipo === "error"),
      undefined,
      { timeout: ms },
    );
  } catch {
    return "tiempo";
  }
  const m = await mensajes(page);
  return m.some((x) => x.tipo === "error") ? "error" : "lista";
}

export const marcoHerramienta = (page: Page) => page.frameLocator("#herramienta");
