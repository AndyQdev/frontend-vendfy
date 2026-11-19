import { expect, test } from "@playwright/test";

import { carrito, cerrarPiloto } from "../helpers/piloto";
import { conManosLibres, microfonoCon } from "./oido";

/**
 * "A ver, a ver. Oye Vendfy, vende dos sprite.": lo que se dijo justo antes de
 * la palabra entra en los 2 s de audio previo y la transcripción ya no empieza
 * con "Oye Vendfy". Antes el servidor la daba por falsa alarma y el piloto se
 * cerraba sin hacer nada; ahora el pedido es lo que sigue a la palabra.
 */
test.use(microfonoCon("antes-de-la-palabra.wav"));

test("con algo dicho antes de «Oye Vendfy», igual vende", async ({ page }) => {
  await conManosLibres(page);
  await expect(page.getByTestId("piloto-tarjeta")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("piloto-linea")).toContainText("¿Algo más?", { timeout: 45_000 });
  await expect(page.getByTestId("piloto-dicho")).toContainText(/vende (2|dos) ?sprite/i);
  await expect(page).toHaveURL(/\/caja/);
  expect((await carrito(page)).map((i) => [i.name, i.quantity])).toEqual([["Sprite 2L", 2]]);
  await cerrarPiloto(page);
  await page.evaluate(() => localStorage.removeItem("vendfy.venta-en-curso.v1"));
});
