import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { decir, ultimaRespuesta } from "../helpers/chat";
import { API_URL, COMERCIO_EMAIL, COMERCIO_PASSWORD, TIENDA } from "../helpers/env";

/**
 * Fase 2 · vender tocando el panel.
 *
 * Cobra de verdad contra el backend, así que cada prueba que cobra también
 * anula y comprueba que el stock quedó como estaba: la tienda de prueba no
 * puede ir perdiendo aceite de a una unidad por corrida.
 */

async function token(request: APIRequestContext) {
  const r = await request.post(`${API_URL}/api/auth/login`, {
    data: { email: COMERCIO_EMAIL, password: COMERCIO_PASSWORD },
  });
  return (await r.json()).data.accessToken as string;
}

async function stockDe(request: APIRequestContext, tok: string, busqueda: string) {
  const h = { Authorization: `Bearer ${tok}` };
  const productos = await (
    await request.get(`${API_URL}/api/omnibox/productos?storeId=${TIENDA.id}&q=${busqueda}`, { headers: h })
  ).json();
  const id = productos.data[0].productId;
  const ficha = await (
    await request.get(`${API_URL}/api/omnibox/producto/${id}?storeId=${TIENDA.id}`, { headers: h })
  ).json();
  return ficha.data.stock as number;
}

async function aceiteAlCarrito(page: Page, veces = 1) {
  await decir(page, "cuánto queda de aceite");
  await ultimaRespuesta(page).getByTestId("omnibox-fila-stock").first().click();
  const mesa = page.getByTestId("omnibox-mesa");
  for (let i = 1; i < veces; i++) await mesa.getByRole("button", { name: "Uno más" }).click();
  await mesa.getByTestId("omnibox-agregar-venta").click();
  await mesa.getByRole("tab", { name: /Venta/ }).click();
  return mesa;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/omnibox");
});

test("cobrar con QR a consumidor final, y anular devuelve el stock", async ({ page, request }) => {
  const tok = await token(request);
  const antes = await stockDe(request, tok, "aceite");

  const mesa = await aceiteAlCarrito(page, 2);
  await expect(mesa.getByTestId("omnibox-cliente")).toHaveText(/Consumidor final/);
  await mesa.getByRole("radio", { name: "QR" }).click();
  await mesa.getByTestId("omnibox-cobrar").click();

  // La venta queda en el hilo y el carrito se vacía.
  const venta = page.getByTestId("omnibox-venta").last();
  await expect(venta).toHaveAttribute("data-estado", "cobrada");
  await expect(venta).toContainText("Consumidor final · QR");
  await expect(venta).toContainText("Bs 36,00");
  await expect(mesa.getByTestId("omnibox-linea-venta")).toHaveCount(0);
  expect(await stockDe(request, tok, "aceite")).toBe(antes - 2);

  // Anular pide confirmación y devuelve el stock.
  await venta.getByTestId("omnibox-anular").click();
  await venta.getByTestId("omnibox-confirmar-anular").click();
  await expect(venta).toHaveAttribute("data-estado", "anulada");
  await expect(venta).toContainText("el stock volvió");
  expect(await stockDe(request, tok, "aceite")).toBe(antes);
});

test("si no hay stock, el motivo aparece al lado del botón y el carrito queda", async ({ page }) => {
  const mesa = await aceiteAlCarrito(page);
  await mesa.getByRole("spinbutton", { name: "Cantidad de Aceite vegetal 1L" }).first().fill("999");

  // D3: se avisa en la línea...
  await expect(mesa.getByRole("alert").first()).toContainText("Pedís 999");
  // ...y no bloquea: el servidor decide y dice por qué.
  await mesa.getByTestId("omnibox-cobrar").click();
  await expect(mesa.getByRole("alert").last()).toContainText("No hay stock suficiente");
  await expect(mesa.getByTestId("omnibox-linea-venta")).toHaveCount(1);
  await expect(page.getByTestId("omnibox-venta")).toHaveCount(0);
});

test("dos clientes parecidos: avisa y deja elegir, sin elegir por su cuenta", async ({ page }) => {
  const mesa = await aceiteAlCarrito(page);
  await mesa.getByTestId("omnibox-cliente").click();
  await mesa.getByLabel("Buscar cliente").fill("andres");

  await expect(mesa.getByText(/Hay 2 parecidos/)).toBeVisible();
  const opciones = mesa.getByRole("option");
  // Consumidor final + los dos Andrés.
  await expect(opciones).toHaveCount(3);

  await opciones.filter({ hasText: /jose andres/i }).click();
  await expect(mesa.getByTestId("omnibox-cliente")).toHaveText(/jose andres/i);
});
