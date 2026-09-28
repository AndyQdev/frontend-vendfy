import { expect, test, type APIRequestContext } from "@playwright/test";

import { decir, ultimaRespuesta } from "../helpers/chat";
import { API_URL, COMERCIO_EMAIL, COMERCIO_PASSWORD, TIENDA } from "../helpers/env";

/**
 * Fase 4 · comprar.
 *
 * Registra una compra de verdad, y una compra recibida NO se puede anular.
 * Para no ir inflando la tienda de prueba, al final se devuelve el stock con
 * un ajuste (el costo promedio sí queda movido: es lo que hace una compra).
 */

async function sesion(request: APIRequestContext) {
  const r = await request.post(`${API_URL}/api/auth/login`, {
    data: { email: COMERCIO_EMAIL, password: COMERCIO_PASSWORD },
  });
  return { Authorization: `Bearer ${(await r.json()).data.accessToken}` };
}

async function stock(request: APIRequestContext, h: Record<string, string>, q: string) {
  const [p] = (await (await request.get(`${API_URL}/api/omnibox/productos?storeId=${TIENDA.id}&q=${q}`, { headers: h })).json()).data;
  const f = (await (await request.get(`${API_URL}/api/omnibox/producto/${p.productId}?storeId=${TIENDA.id}`, { headers: h })).json()).data;
  return { productId: p.productId as string, nombre: p.nombre as string, stock: f.stock as number };
}

/**
 * Devuelve el stock con un ajuste. Si el ajuste falla, la prueba FALLA: la
 * primera versión no miraba la respuesta y dejó la coca en 15 sin avisar.
 */
async function dejarEn(
  request: APIRequestContext,
  h: Record<string, string>,
  p: { productId: string; nombre: string; stock: number },
) {
  const r = await request.post(`${API_URL}/api/omnibox/confirmar`, {
    headers: h,
    data: {
      intencion: "ajustar_stock",
      entidades: { producto: p.nombre, productId: p.productId, cantidad: p.stock, motivo: "prueba e2e: vuelve como estaba" },
      storeId: TIENDA.id,
    },
  });
  expect(r.ok(), `no se pudo devolver el stock de ${p.nombre}: ${await r.text()}`).toBe(true);
}

test("cargar una compra hablando, pasar a una venta y volver, y registrarla", async ({ page, request }) => {
  const h = await sesion(request);
  const coca0 = await stock(request, h, "coca");
  const arroz0 = await stock(request, h, "arroz");

  try {
    await page.goto("/omnibox");
    const mesa = page.getByTestId("omnibox-mesa");
    const lineas = page.getByTestId("omnibox-linea-compra");

    // Dos productos con su costo, en una frase.
    await decir(page, "compré 3 cocas a 11 y 2 arroz a 30");
    await expect(mesa).toHaveAttribute("data-mesa", "compra");
    await expect(lineas).toHaveCount(2);
    await expect(mesa.getByLabel("Costo de Coca Cola 2L")).toHaveValue("11");

    // Corregir el costo y poner el proveedor, hablando.
    await decir(page, "la coca me salió a 10");
    await expect(mesa.getByLabel("Costo de Coca Cola 2L")).toHaveValue("10");
    await decir(page, "es de Distribuidora Andina");
    await expect(mesa.getByPlaceholder("Distribuidora, marca…")).toHaveValue("Distribuidora Andina");

    // Vender en el medio: la compra se guarda en el chip y se vuelve a ella.
    await decir(page, "vendí un aceite vegetal");
    await expect(mesa).toHaveAttribute("data-mesa", "venta");
    const chip = page.getByTestId("omnibox-chip-mesa");
    await expect(chip).toHaveText(/Compra en curso · 2/);
    await chip.click();
    await expect(mesa).toHaveAttribute("data-mesa", "compra");
    await expect(lineas).toHaveCount(2);
    await expect(mesa.getByTestId("omnibox-total-compra")).toHaveText(/Bs 90,00/); // 3×10 + 2×30

    // "Registrá la compra" NO se hace sola: pide confirmar.
    await decir(page, "registrá la compra");
    await expect(ultimaRespuesta(page)).toHaveAttribute("data-estado", "confirmar-compra");
    await ultimaRespuesta(page).getByTestId("omnibox-confirmar-compra-chat").click();

    const tarjeta = page.getByTestId("omnibox-compra").last();
    await expect(tarjeta).toContainText("Compra registrada");
    await expect(tarjeta).toContainText("Distribuidora Andina");
    await expect(tarjeta).toContainText("Bs 90,00");
    await expect(lineas).toHaveCount(0);

    expect((await stock(request, h, "coca")).stock).toBe(coca0.stock + 3);
    expect((await stock(request, h, "arroz")).stock).toBe(arroz0.stock + 2);
  } finally {
    await dejarEn(request, h, coca0);
    await dejarEn(request, h, arroz0);
    expect((await stock(request, h, "coca")).stock).toBe(coca0.stock);
  }
});
