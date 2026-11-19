import { expect, type Page } from "@playwright/test";

/**
 * Escribir en el asistente y esperar la respuesta.
 *
 * Espera a que desaparezca el "Pensando…", no un tiempo fijo: la
 * interpretación tarda entre 1 y 6 segundos según el modelo, y un `sleep`
 * haría la suite lenta cuando va rápido y frágil cuando va lento.
 */
export async function decir(page: Page, texto: string) {
  const campo = page.getByLabel("Qué necesitas");
  await campo.fill(texto);
  await campo.press("Enter");
  await expect(page.getByTestId("omnibox-pensando")).toHaveCount(0, { timeout: 30_000 });
}

/** La última tarjeta de respuesta del hilo. */
export function ultimaRespuesta(page: Page) {
  return page.getByTestId("omnibox-actividad").last();
}

/** Dictar con el micrófono falso: grabar un momento, soltar y esperar la respuesta. */
export async function dictarAlgo(page: Page) {
  await page.getByRole("button", { name: "Dictar" }).click();
  await expect(page.getByRole("button", { name: "Detener el dictado" })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Detener el dictado" }).click();
  await expect(page.getByTestId("omnibox-pensando")).toHaveCount(0, { timeout: 30_000 });
}
