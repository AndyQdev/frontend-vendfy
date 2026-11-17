import path from "node:path";

import { expect, type Page } from "@playwright/test";

/** Chrome con un WAV de e2e/fixtures/oido como micrófono (suena una vez, desde que se abre). */
export function microfonoCon(archivo: string) {
  const wav = path.resolve("e2e/fixtures/oido", archivo);
  return {
    launchOptions: {
      args: [
        "--autoplay-policy=no-user-gesture-required",
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        `--use-file-for-fake-audio-capture=${wav}%noloop`,
      ],
    },
  };
}

/**
 * Entra con manos libres prendido: al cargar, el oído abre el micrófono y ahí
 * empieza a "sonar" el WAV (5 s de tienda y después lo que se dice).
 */
export async function conManosLibres(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("vendfy.manosLibres", "1");
    localStorage.removeItem("vendfy.venta-en-curso.v1");
    // Cada vez que se abre la tarjeta de Vendfy (para contar falsas alarmas).
    (window as any).__aperturas = 0;
    new MutationObserver(() => {
      const abierta = Boolean(document.querySelector('[data-testid="piloto-tarjeta"]'));
      if (abierta && !(window as any).__abierta) (window as any).__aperturas++;
      (window as any).__abierta = abierta;
    }).observe(document, { subtree: true, childList: true });
  });
  await page.goto("/inventory");
  await expect(page.locator('[data-testid="piloto-manos-libres"][data-estado="escuchando"]')).toBeVisible({ timeout: 60_000 });
}
