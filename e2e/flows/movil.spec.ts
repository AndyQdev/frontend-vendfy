import { expect, test } from "@playwright/test";

import { decir, ultimaRespuesta } from "../helpers/chat";

/**
 * En el teléfono el panel no entra al costado: sube desde abajo.
 */
test("la ficha sube como hoja y se cierra sin perder la venta", async ({ page }) => {
  await page.goto("/omnibox");
  await decir(page, "cuánto queda de coca");
  await ultimaRespuesta(page).getByTestId("omnibox-fila-stock").first().click();

  const mesa = page.getByTestId("omnibox-mesa");
  await expect(mesa).toBeVisible();
  // Ocupa el ancho de la pantalla: es hoja, no columna.
  const caja = await mesa.boundingBox();
  expect(caja!.width).toBeGreaterThan(page.viewportSize()!.width * 0.9);

  await mesa.getByTestId("omnibox-agregar-venta").click();
  await mesa.getByRole("button", { name: "Cerrar el panel" }).click();

  await expect(page.getByTestId("omnibox-chip-mesa")).toHaveText(/Venta en curso · 1/);
});
