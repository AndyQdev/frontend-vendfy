import { expect, test } from "@playwright/test";

import { cerrarPiloto } from "../helpers/piloto";
import { conManosLibres, microfonoCon } from "./oido";

/** "Oye Vendfy." … (una pausa, como con Siri) … "¿A cuánto está el dólar?" */
test.use(microfonoCon("pausa.wav"));

test("con una pausa después de la palabra, espera la pregunta y la contesta", async ({ page }) => {
  await conManosLibres(page);
  await expect(page.getByTestId("piloto-tarjeta")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("piloto-linea")).toContainText(/dólar/i, { timeout: 45_000 });
  // Una consulta no lleva a ninguna pantalla.
  await expect(page).toHaveURL(/\/inventory/);
  await cerrarPiloto(page);
});
