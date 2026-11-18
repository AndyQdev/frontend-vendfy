import { expect, test } from "@playwright/test";

import { carrito, cerrarPiloto } from "../helpers/piloto";
import { conManosLibres, microfonoCon } from "./oido";

/**
 * "Oye Vendfy, vende dos sprite." dicho de corrido (una voz que el detector
 * nunca escuchó, con ruido de tienda): oye la palabra en el equipo, se abre
 * Vendfy, el servidor confirma la palabra y la quita, y la Caja queda cargada.
 */
test.use(microfonoCon("positiva.wav"));

test("oye «Oye Vendfy» y vende sin tocar nada", async ({ page }) => {
  await conManosLibres(page);
  await expect(page.getByTestId("piloto-tarjeta")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("piloto-linea")).toContainText("¿Algo más?", { timeout: 45_000 });
  // Lo que se entendió ya no trae la palabra.
  await expect(page.getByTestId("piloto-dicho")).toContainText(/vende (2|dos) ?sprite/i);
  await expect(page.getByTestId("piloto-dicho")).not.toContainText(/vendfy/i);
  await expect(page).toHaveURL(/\/caja/);
  expect((await carrito(page)).map((i) => [i.name, i.quantity])).toEqual([["Sprite 2L", 2]]);
  await cerrarPiloto(page);
  await page.evaluate(() => localStorage.removeItem("vendfy.venta-en-curso.v1"));
});
