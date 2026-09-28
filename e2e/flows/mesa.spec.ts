import { expect, test } from "@playwright/test";

import { decir, ultimaRespuesta } from "../helpers/chat";

/**
 * Fase 0 + 1 · la mesa de trabajo.
 *
 * Tocar un producto en el chat lo abre a la derecha SIN salir de /omnibox;
 * agregarlo arma la venta; cerrar el panel no la pierde.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/omnibox");
});

test("sin conversación el campo está al centro, y baja con el primer mensaje", async ({ page }) => {
  const campo = page.getByLabel("Qué necesitás");
  const alto = page.viewportSize()!.height;

  const antes = await campo.boundingBox();
  expect(antes!.y).toBeLessThan(alto * 0.75);

  await decir(page, "cuánto queda de coca");

  const despues = await campo.boundingBox();
  expect(despues!.y + despues!.height).toBeGreaterThan(alto * 0.85);
  // Sigue con el foco: se puede seguir escribiendo sin tocar la pantalla.
  await expect(campo).toBeFocused();
});

test("tocar un producto abre su ficha a la derecha, sin navegar", async ({ page }) => {
  await decir(page, "cuánto queda de aceite");
  const filas = ultimaRespuesta(page).getByTestId("omnibox-fila-stock");
  await expect(filas).toHaveCount(2);

  await filas.first().click();

  await expect(page).toHaveURL(/\/omnibox$/);
  const mesa = page.getByTestId("omnibox-mesa");
  await expect(mesa).toBeVisible();
  const ficha = mesa.getByTestId("omnibox-ficha");
  await expect(ficha).toContainText("Aceite vegetal 1L");
  // El detalle llega del backend: marca, notas y stock de la tienda.
  await expect(ficha).toContainText("La Favorita");
  await expect(ficha).toContainText("Aceite vegetal puro");
  await expect(ficha).toContainText("Abarrotes Don Juan");
  // La fila de la que salió queda marcada.
  await expect(filas.first()).toHaveAttribute("aria-pressed", "true");
});

test("agregar a la venta, cerrar el panel y volver con el chip", async ({ page }) => {
  await decir(page, "cuánto queda de aceite");
  const filas = ultimaRespuesta(page).getByTestId("omnibox-fila-stock");

  // Aceite × 2
  await filas.first().click();
  const mesa = page.getByTestId("omnibox-mesa");
  await mesa.getByRole("button", { name: "Uno más" }).click();
  await mesa.getByTestId("omnibox-agregar-venta").click();

  // Atún × 1
  await filas.nth(1).click();
  await mesa.getByTestId("omnibox-agregar-venta").click();

  await mesa.getByRole("tab", { name: /Venta/ }).click();
  await expect(mesa.getByTestId("omnibox-linea-venta")).toHaveCount(2);
  // 2 × Bs 18 + 1 × Bs 15
  await expect(mesa.getByTestId("omnibox-total-venta")).toHaveText(/Bs 51,00/);

  // Cerrar no pierde nada: queda el chip para volver.
  await mesa.getByRole("button", { name: "Cerrar el panel" }).click();
  await expect(mesa).toHaveCount(0);
  const chip = page.getByTestId("omnibox-chip-mesa");
  await expect(chip).toHaveText(/Venta en curso · 2/);

  await chip.click();
  await expect(page.getByTestId("omnibox-mesa")).toBeVisible();
  await expect(page.getByTestId("omnibox-linea-venta")).toHaveCount(2);
});

test("ampliar esconde el chat y achicar lo devuelve", async ({ page }) => {
  await decir(page, "cuánto queda de coca");
  await ultimaRespuesta(page).getByTestId("omnibox-fila-stock").first().click();

  const mesa = page.getByTestId("omnibox-mesa");
  await mesa.getByRole("button", { name: "Ampliar el panel" }).click();
  await expect(page.getByLabel("Qué necesitás")).toBeHidden();

  await mesa.getByRole("button", { name: "Achicar el panel" }).click();
  await expect(page.getByLabel("Qué necesitás")).toBeVisible();
});
