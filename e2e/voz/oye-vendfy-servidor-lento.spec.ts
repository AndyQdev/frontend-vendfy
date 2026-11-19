import { expect, test } from "@playwright/test";

import { microfonoCon, conManosLibres } from "./oido";

/**
 * El servidor no contesta. Antes la bola se quedaba en «Entendiendo…» para
 * siempre (pasó en la app de Windows, 19/11); ahora avisa que sigue en eso, a
 * los 45 s dice que se demoró y vuelve a su lugar.
 */
test.use(microfonoCon("positiva.wav"));

test("si el servidor no contesta, avisa y se cierra", async ({ page }) => {
  test.setTimeout(150_000);
  // La respuesta no llega nunca: el pedido queda colgado.
  await page.route("**/api/omnibox/voz", () => new Promise(() => undefined));
  await conManosLibres(page);
  await expect(page.getByTestId("piloto-tarjeta")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("piloto-linea")).toContainText("Dame un momento", { timeout: 40_000 });
  await expect(page.getByTestId("piloto-linea")).toContainText("se está demorando", { timeout: 60_000 });
  await expect(page.getByTestId("piloto-tarjeta")).toBeHidden({ timeout: 30_000 });
});

test("sin internet, lo dice en español y se cierra", async ({ page }) => {
  await page.route("**/api/omnibox/voz", (r) => r.abort("internetdisconnected"));
  await conManosLibres(page);
  await expect(page.getByTestId("piloto-tarjeta")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("piloto-linea")).toContainText("No me pude conectar", { timeout: 40_000 });
  await expect(page.getByTestId("piloto-tarjeta")).toBeHidden({ timeout: 30_000 });
});
