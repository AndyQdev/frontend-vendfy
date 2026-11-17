import { expect, test } from "@playwright/test";

import { carrito } from "../helpers/piloto";
import { conManosLibres, microfonoCon } from "./oido";

/**
 * Lo que NO es "Oye Vendfy": "Oye, vendí dos cocas. Dame una Pepsi, por
 * favor." y 20 s de charla. No tiene que vender ni quedar abierto: si el
 * detector dudara, el servidor no encuentra la palabra y se cierra solo.
 */
test.use(microfonoCon("negativa.wav"));

test("frases parecidas y charla de tienda no hacen nada", async ({ page }) => {
  await conManosLibres(page);
  await page.waitForTimeout(32_000);
  expect(await carrito(page)).toEqual([]);
  await expect(page.getByTestId("piloto-tarjeta")).toBeHidden();
  const aperturas = await page.evaluate(() => (window as any).__aperturas as number);
  test.info().annotations.push({ type: "aperturas", description: `${aperturas} (falsas alarmas descartadas por el servidor)` });
  expect(aperturas).toBeLessThanOrEqual(1);
});
