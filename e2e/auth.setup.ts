import { expect, test as setup } from "@playwright/test";

import { COMERCIO_EMAIL, COMERCIO_PASSWORD, TIENDA } from "./helpers/env";

const ARCHIVO_SESION = "e2e/.auth/session.json";

/**
 * Inicia sesión una vez, elige la tienda de prueba y guarda el estado.
 *
 * El resto de los tests arrancan ya autenticados: pasar por el formulario en
 * cada uno agrega segundos y hace que un cambio en el login rompa toda la
 * suite en vez de un solo test.
 */
setup("entrar como el comerciante de prueba", async ({ page }) => {
  await page.goto("/login");

  // Puede haber más de un formulario según el ancho: se usa el visible.
  const form = page.locator("form").filter({ has: page.locator("input[type=password]") }).first();
  await form.locator("input[type=email]").fill(COMERCIO_EMAIL);
  await form.locator("input[type=password]").fill(COMERCIO_PASSWORD);
  await form.locator("button[type=submit]").click();

  // A dónde lleva el login depende de la configuración del momento (hoy la
  // Caja): basta con que haya salido del formulario.
  await expect(page).not.toHaveURL(/\/login/);

  // La tienda se elige por localStorage, como lo hace el selector.
  await page.evaluate((t) => localStorage.setItem("selectedStore", JSON.stringify(t)), TIENDA);
  await page.goto("/omnibox");
  await expect(page.getByLabel("Qué necesitás")).toBeVisible();

  await page.context().storageState({ path: ARCHIVO_SESION });
});
