import { expect, test } from "@playwright/test";

import { TIENDA } from "../helpers/env";
import { api, carrito, cerrarPiloto, fijarStock, pedirAlPiloto, stockDe } from "../helpers/piloto";

/**
 * El piloto "Vendfy" maneja las pantallas reales: lleva a la Caja, al
 * Inventario, a Pedidos o al formulario de producto, lo llena frente a la
 * persona y hace lo pedido solo con el "sí". Cada prueba deja la tienda como
 * estaba (anula la venta, devuelve el stock, da de baja el producto).
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/inventory");
  await page.evaluate(() => localStorage.removeItem("vendfy.venta-en-curso.v1"));
  await expect(page.getByTestId("piloto-lanzador")).toBeVisible();
});

test.afterEach(async ({ page }) => {
  await cerrarPiloto(page);
  await page.evaluate(() => localStorage.removeItem("vendfy.venta-en-curso.v1"));
});

test("vende y cobra en la Caja: lleva, carga, pregunta y cobra con el sí", async ({ page }) => {
  let ventaId: string | null = null;
  page.on("response", async (r) => {
    if (r.url().endsWith("/api/omnibox/cobrar") && r.request().method() === "POST") ventaId = (await r.json().catch(() => ({}))).data?.orderId ?? null;
  });
  try {
    await pedirAlPiloto(page, "vende 2 sprite y un agua mineral", "¿Algo más?");
    await expect(page).toHaveURL(/\/caja/);
    expect((await carrito(page)).map((i) => [i.name, i.quantity])).toEqual([
      ["Sprite 2L", 2],
      ["Agua mineral 2L", 1],
    ]);
    // La tarjeta señala el total mientras pregunta.
    await expect(page.locator(".piloto-foco")).toBeVisible();

    await pedirAlPiloto(page, "no", "¿Con qué paga?");
    await pedirAlPiloto(page, "con QR", "¿Lo cobro con QR?");
    await pedirAlPiloto(page, "sí", /Venta #\d+ registrada/);
    expect(await carrito(page)).toEqual([]);
    expect(ventaId).not.toBeNull();
  } finally {
    if (ventaId) await api(page, `/omnibox/ventas/${ventaId}/anular`, { method: "POST", body: { storeId: TIENDA.id } });
  }
});

test('"no" a "¿Lo cobro?" deja la venta abierta; "para" lo detiene', async ({ page }) => {
  await pedirAlPiloto(page, "vende una sal fina", "¿Algo más?");
  await pedirAlPiloto(page, "cóbrale con tarjeta", /Venta|¿Lo cobro/).catch(() => undefined);
  // "Cóbrale con tarjeta" ya es la orden: si llegó a cobrar, se anula al final.
  const linea = await page.getByTestId("piloto-linea").textContent();
  if (/registrada/.test(linea ?? "")) {
    const numero = Number(linea!.match(/#(\d+)/)![1]);
    const ventas = await api(page, `/order?storeId=${TIENDA.id}&limit=5`);
    const venta = (ventas.data ?? ventas).find((v: any) => v.number === numero || v.orderNumber === numero);
    if (venta) await api(page, `/omnibox/ventas/${venta.id}/anular`, { method: "POST", body: { storeId: TIENDA.id } });
  }
  await page.evaluate(() => localStorage.removeItem("vendfy.venta-en-curso.v1"));

  await pedirAlPiloto(page, "vende una sal fina", "¿Algo más?");
  await pedirAlPiloto(page, "no", "¿Con qué paga?");
  await pedirAlPiloto(page, "efectivo", "¿Lo cobro con efectivo?");
  await pedirAlPiloto(page, "no", "queda abierta");
  expect((await carrito(page)).map((i) => i.name)).toEqual(["Sal fina 1kg"]);
  await pedirAlPiloto(page, "para", "me detengo");
});

test("corrige el stock de uno: lo busca, marca la fila y ajusta con el sí", async ({ page }) => {
  const antes = await stockDe(page, "Sprite 2L");
  const nuevo = antes.stock + 3;
  try {
    await pedirAlPiloto(page, `el stock de la sprite está mal, hay ${nuevo}`, "¿Lo ajusto?");
    await expect(page.getByPlaceholder("Buscar o escanear un producto...")).toHaveValue("Sprite 2L");
    await expect(page.locator(`[data-piloto~="inventario:${antes.productId}"]`)).toBeVisible();
    await expect(page.getByTestId("piloto-linea")).toContainText(`hay ${antes.stock}, quedan ${nuevo}`);
    await pedirAlPiloto(page, "sí", "stock corregido");
    expect((await stockDe(page, "Sprite 2L")).stock).toBe(nuevo);
  } finally {
    await fijarStock(page, antes.productId, "Sprite 2L", antes.stock);
  }
});

test("corrige el stock de varios en una frase, con la tabla de antes y después", async ({ page }) => {
  const nombres = ["Sprite 2L", "Coca Cola 2L", "Agua mineral 2L"];
  const antes = await Promise.all(nombres.map((n) => stockDe(page, n)));
  try {
    await pedirAlPiloto(page, `arregla el stock: sprite ${antes[0].stock + 1}, coca cola ${antes[1].stock + 1} y agua mineral ${antes[2].stock + 1}`, "¿Los ajusto?");
    await expect(page.getByTestId("piloto-tabla").locator("li")).toHaveCount(3);
    await pedirAlPiloto(page, "sí", "corregí el stock de 3");
    const despues = await Promise.all(nombres.map((n) => stockDe(page, n)));
    expect(despues.map((d) => d.stock)).toEqual(antes.map((a) => a.stock + 1));
  } finally {
    await Promise.all(antes.map((a, i) => fijarStock(page, a.productId, nombres[i], a.stock)));
  }
});

test("mueve un pedido de estado con el sí", async ({ page }) => {
  const sprite = await stockDe(page, "Sprite 2L");
  const venta = await api(page, "/omnibox/cobrar", {
    method: "POST",
    body: { storeId: TIENDA.id, lineas: [{ storeProductId: sprite.storeProductId, cantidad: 1, precio: 12 }], clienteId: null, pago: "efectivo" },
  });
  try {
    await pedirAlPiloto(page, `pasa el pedido ${venta.numero} a en camino`, "¿Paso el pedido", 90_000);
    await expect(page).toHaveURL(/\/orders/);
    await expect(page.getByTestId("piloto-tabla")).toContainText("En camino");
    await pedirAlPiloto(page, "sí", "pasó a en camino");
    await expect(page.locator(`[data-piloto~="pedido:${venta.orderId}"]`)).toBeVisible();
  } finally {
    await api(page, `/omnibox/ventas/${venta.orderId}/anular`, { method: "POST", body: { storeId: TIENDA.id } });
  }
});

test("crea un producto llenando el formulario y preguntando lo que falta", async ({ page }) => {
  // Un nombre único y sin números (el asistente toma "56647" como una cantidad, no como nombre).
  const sabores = ["Kiwi", "Mango", "Coco", "Menta", "Ciruela", "Pera", "Higo", "Maracuya", "Lima", "Durazno"];
  // Dos sabores distintos: con el mismo dos veces ("Ciruela Ciruela") el asistente deja uno solo.
  const primero = Date.now() % sabores.length;
  const segundo = (primero + 1 + (Math.floor(Date.now() / 7) % (sabores.length - 1))) % sabores.length;
  const nombre = `Galletas Piloto ${sabores[primero]} ${sabores[segundo]}`;
  let creado: { product: { id: string; price: number }; stockQuantity: number } | null = null;
  try {
    await pedirAlPiloto(page, `crea un producto ${nombre.toLowerCase()} a 8 bolivianos`, "¿Cuántas tienes", 90_000);
    await expect(page).toHaveURL(/\/products\/create/);
    await expect(page.locator("#name")).toHaveValue(new RegExp(nombre, "i"));
    await expect(page.locator("#price")).toHaveValue("8");
    await pedirAlPiloto(page, "doce", "¿Lo creo?");
    await expect(page.locator("#initialStock")).toHaveValue("12");
    await pedirAlPiloto(page, "sí", "creé");
    const lista = await api(page, `/inventory?storeId=${TIENDA.id}&search=${encodeURIComponent(nombre)}&limit=5`);
    creado = (lista.data ?? lista).find((x: any) => x.product.name.toLowerCase() === nombre.toLowerCase()) ?? null;
    expect(creado).not.toBeNull();
    expect(Number(creado!.product.price)).toBe(8);
    expect(Number(creado!.stockQuantity)).toBe(12);
  } finally {
    if (creado) await api(page, `/omnibox/producto/${creado.product.id}/baja`, { method: "POST", body: { storeId: TIENDA.id } });
  }
});

test("una consulta se dice sin tocar la pantalla; lo que no existe, también", async ({ page }) => {
  await pedirAlPiloto(page, "¿a cuánto está el dólar?", /dólar/i);
  await expect(page).toHaveURL(/\/inventory/);
  await pedirAlPiloto(page, "vende una cerveza paceña", /Cerveza|no encontr|asistente/i, 90_000);
  expect(await carrito(page)).toEqual([]);
});
