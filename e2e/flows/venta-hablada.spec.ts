import { expect, test } from "@playwright/test";

import { decir, ultimaRespuesta } from "../helpers/chat";

/**
 * Fase 3 · vender hablando.
 *
 * La misma venta que se arma tocando, armada solo con frases. Cobra de
 * verdad (D2) y anula al final: el stock de la tienda de prueba queda igual.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/omnibox");
});

test("armar, corregir, poner cliente y cobrar solo hablando", async ({ page }) => {
  const mesa = page.getByTestId("omnibox-mesa");
  const lineas = page.getByTestId("omnibox-linea-venta");

  await decir(page, "sumá 2 cocas");
  await expect(ultimaRespuesta(page)).toHaveAttribute("data-estado", "mesa");
  await expect(ultimaRespuesta(page)).toContainText("2 × Coca Cola 2L");
  await expect(lineas).toHaveCount(1);

  await decir(page, "dame un arroz");
  await expect(lineas).toHaveCount(2);

  // "que sean 3" sin decir de qué: la última agregada (el arroz).
  await decir(page, "que sean 3");
  await expect(ultimaRespuesta(page)).toContainText(/Arroz.*ahora son 3/);

  await decir(page, "sacá el arroz");
  await expect(lineas).toHaveCount(1);

  // Dos clientes se parecen a "andrés": pregunta, no elige.
  await decir(page, "es para andrés");
  const tarjeta = ultimaRespuesta(page);
  await expect(tarjeta).toHaveAttribute("data-estado", "elegir-cliente");
  await expect(tarjeta.getByTestId("omnibox-opcion-cliente")).toHaveCount(2);
  await tarjeta.getByTestId("omnibox-opcion-cliente").filter({ hasText: /cabrera/i }).first().click();
  await expect(mesa.getByTestId("omnibox-cliente")).not.toHaveText(/Consumidor final/);

  // D2: cobrar hablando, con el método en la misma frase.
  await decir(page, "cobrale con QR");
  const venta = page.getByTestId("omnibox-venta").last();
  await expect(venta).toHaveAttribute("data-estado", "cobrada");
  await expect(venta).toContainText("QR");
  await expect(venta).toContainText("Bs 24,00");
  await expect(lineas).toHaveCount(0);

  // Dejar el stock como estaba.
  await venta.getByTestId("omnibox-anular").click();
  await venta.getByTestId("omnibox-confirmar-anular").click();
  await expect(venta).toHaveAttribute("data-estado", "anulada");
});

test("un cliente que no existe se ofrece crear, con el nombre dicho", async ({ page }) => {
  await decir(page, "sumá una coca");
  await decir(page, "a nombre de Zacarías Inexistente");
  const tarjeta = ultimaRespuesta(page);
  await expect(tarjeta).toHaveAttribute("data-estado", "elegir-cliente");
  await expect(tarjeta).toContainText("No tenés a");
  await expect(tarjeta.getByLabel("Nombre del cliente")).toHaveValue("Zacarías Inexistente");
});

test("lo que no se puede aplicar se dice, sin sugerir otra cosa", async ({ page }) => {
  await decir(page, "sumá una coca");
  await decir(page, "sacá el fideo");
  await expect(ultimaRespuesta(page)).toHaveAttribute("data-estado", "aviso");
  await expect(ultimaRespuesta(page)).toContainText("no está en esta venta");
});

test("un pedido de varias cosas: agrega lo claro y deja elegir VARIOS de lo dudoso", async ({ page }) => {
  await decir(page, "sumá una coca, 3 arroz y un aceite para el cliente Andrés Cabrera");
  const tarjeta = ultimaRespuesta(page);
  await expect(tarjeta).toHaveAttribute("data-estado", "pedido");

  const lineas = page.getByTestId("omnibox-linea-venta");
  await expect(lineas).toHaveCount(2); // coca y arroz entraron solos
  await expect(tarjeta.getByTestId("omnibox-cliente-pedido")).toContainText("Para Andrés Cabrera");

  // "aceite" es dudoso: se pueden elegir los dos.
  const opciones = tarjeta.getByTestId("omnibox-opcion-item");
  await expect(opciones).toHaveCount(2);
  await opciones.nth(0).click();
  await opciones.nth(1).click();
  await expect(lineas).toHaveCount(4);
  await expect(tarjeta).toHaveAttribute("data-estado", "pedido-listo");

  // No se cobra: se deja la venta vacía.
  await decir(page, "borrá todo");
  await expect(lineas).toHaveCount(0);
});
