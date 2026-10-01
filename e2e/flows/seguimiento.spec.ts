import { expect, test } from "@playwright/test";

import { animaciones, grabarAnimaciones, vuelos } from "../helpers/animaciones";
import { decir } from "../helpers/chat";
import { agregarAVenta, productoReal, propuesta, simularCobro, simularFrases } from "../helpers/mock";

/**
 * Fase G1 · seguimiento visual: lo que se dice o se toca se VE pasar en la
 * mesa. Interpretación y cobro simulados (helpers/mock.ts).
 */

const dinero = (n: number) => n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

test("vender hablando: la foto vuela al carrito, la línea entra y el total cuenta", async ({ page, request }) => {
  const aceite = await productoReal(request, "aceite");
  await simularFrases(page, { "vendé un aceite": agregarAVenta(aceite) });
  await page.goto("/omnibox");
  await grabarAnimaciones(page);

  await decir(page, "vendé un aceite");
  const mesa = page.getByTestId("omnibox-mesa");
  await expect(mesa.getByTestId("omnibox-total-venta")).toHaveText(`Bs ${dinero(aceite.precio)}`);

  await expect.poll(() => vuelos(page)).toBe(1);
  // El clon se borra al llegar: no queda basura flotando.
  await expect(page.getByTestId("coreografia-vuelo")).toHaveCount(0);
  await expect
    .poll(async () => (await animaciones(page)).map((a) => `${a.clase}@${a.en}`))
    .toEqual(expect.arrayContaining([`linea-entra@linea:venta:${aceite.productId}`, `aterriza@foto:venta:${aceite.productId}`]));
  // Una sola entrada: la línea no "entra" dos veces.
  expect((await animaciones(page)).filter((a) => a.clase === "linea-entra")).toHaveLength(1);
});

test('"que sean 3": la cantidad salta y el total cuenta hasta el nuevo valor', async ({ page, request }) => {
  const aceite = await productoReal(request, "aceite");
  await simularFrases(page, {
    "vendé un aceite": agregarAVenta(aceite),
    "que sean 3": propuesta({
      intencion: "cambiar_cantidad_venta",
      entidades: { productId: aceite.productId, producto: aceite.nombre, cantidad: 3, mesa: "venta" },
    }),
  });
  await page.goto("/omnibox");
  await decir(page, "vendé un aceite");
  await grabarAnimaciones(page);

  await decir(page, "que sean 3");
  await expect(page.getByTestId("omnibox-total-venta")).toHaveText(`Bs ${dinero(aceite.precio * 3)}`);
  await expect(page.getByTestId("omnibox-cobrar")).toContainText(`Cobrar Bs ${dinero(aceite.precio * 3)}`);
  await expect
    .poll(async () => (await animaciones(page)).map((a) => `${a.clase}@${a.en}`))
    .toContain(`cantidad-cambia@campo:cantidad:${aceite.productId}`);
  expect(await vuelos(page)).toBe(0); // no entró nada nuevo: nada vuela
});

test('"cobrale con QR": el método se marca, el botón se presiona solo y la venta se sella', async ({ page, request }) => {
  const aceite = await productoReal(request, "aceite");
  await simularFrases(page, {
    "vendé un aceite": agregarAVenta(aceite),
    "cobrale con QR": propuesta({ intencion: "cobrar", entidades: { pago: "qr" } }),
  });
  const cobros = await simularCobro(page, { total: aceite.precio });
  await page.goto("/omnibox");
  await decir(page, "vendé un aceite");
  await grabarAnimaciones(page);

  await decir(page, "cobrale con QR");
  const venta = page.getByTestId("omnibox-venta");
  await expect(venta).toHaveAttribute("data-estado", "cobrada");
  await expect(venta).toHaveClass(/tarjeta-sella/);
  expect(cobros[0].postDataJSON().pago).toBe("qr");
  const hechas = (await animaciones(page)).map((a) => `${a.clase}@${a.en}`);
  expect(hechas).toContain("boton-presiona@testid:omnibox-cobrar");
  expect(hechas).toContain("campo-completo@campo:pago");
});

test("tocar Cobrar no 'se presiona solo' (ya lo presionó el dedo)", async ({ page, request }) => {
  const aceite = await productoReal(request, "aceite");
  await simularFrases(page, { "vendé un aceite": agregarAVenta(aceite) });
  await simularCobro(page, { total: aceite.precio });
  await page.goto("/omnibox");
  await decir(page, "vendé un aceite");
  const mesa = page.getByTestId("omnibox-mesa");
  await mesa.getByRole("radio", { name: "Efectivo" }).click();
  await grabarAnimaciones(page);
  await mesa.getByTestId("omnibox-cobrar").click();
  await expect(page.getByTestId("omnibox-venta")).toHaveAttribute("data-estado", "cobrada");
  expect((await animaciones(page)).map((a) => a.clase)).not.toContain("boton-presiona");
});

test("una compra de varias cosas: las líneas entran escalonadas, una tras otra", async ({ page, request }) => {
  const coca = await productoReal(request, "coca");
  const arroz = await productoReal(request, "arroz");
  await simularFrases(page, {
    "compré 3 cocas a 11 y 2 arroz a 30": propuesta({
      intencion: "agregar_a_compra",
      items: [
        { texto: "3 cocas a 11", buscado: "coca", cantidad: 3, precio: 11, producto: coca, opciones: [], noEncontrado: null },
        { texto: "2 arroz a 30", buscado: "arroz", cantidad: 2, precio: 30, producto: arroz, opciones: [], noEncontrado: null },
      ],
      costos: {},
    }),
  });
  await page.goto("/omnibox");
  await grabarAnimaciones(page);
  await decir(page, "compré 3 cocas a 11 y 2 arroz a 30");

  await expect(page.getByTestId("omnibox-total-compra")).toHaveText(`Bs ${dinero(3 * 11 + 2 * 30)}`);
  await expect
    .poll(async () => (await animaciones(page)).filter((a) => a.clase === "linea-entra").map((a) => `${a.en}|${a.retraso}`))
    .toEqual([`linea:compra:${coca.productId}|`, `linea:compra:${arroz.productId}|90ms`]);
});

test("registrar una compra: la tarjeta muestra cómo sube el stock de cada producto", async ({ page, request }) => {
  const coca = await productoReal(request, "coca");
  await simularFrases(page, {
    "compré 6 cocas a 11": propuesta({
      intencion: "agregar_a_compra",
      items: [{ texto: "6 cocas a 11", buscado: "coca", cantidad: 6, precio: 11, producto: coca, opciones: [], noEncontrado: null }],
      costos: {},
    }),
  });
  await page.route("**/api/omnibox/compras", (route) =>
    route.fulfill({
      status: 201,
      json: { statusCode: 201, data: { purchaseOrderId: "po-1", referencia: null, proveedor: null, total: 66, unidades: 6, adjunto: null } },
    }),
  );
  await page.goto("/omnibox");
  await decir(page, "compré 6 cocas a 11");
  const mesa = page.getByTestId("omnibox-mesa");
  await mesa.getByTestId("omnibox-registrar-compra").click();
  await mesa.getByTestId("omnibox-confirmar-compra").click();

  const compra = page.getByTestId("omnibox-compra");
  await expect(compra).toHaveClass(/tarjeta-sella/);
  await expect(compra.getByTestId("omnibox-stock-sube")).toHaveText(`stock ${coca.stock} → ${Number(coca.stock) + 6}`);
});

test("con movimiento reducido: nada vuela ni rebota, y el total aparece directo", async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const aceite = await productoReal(request, "aceite");
  await simularFrases(page, { "vendé un aceite": agregarAVenta(aceite) });
  await page.goto("/omnibox");
  await grabarAnimaciones(page);
  await decir(page, "vendé un aceite");
  await expect(page.getByTestId("omnibox-total-venta")).toHaveText(`Bs ${dinero(aceite.precio)}`);
  await page.waitForTimeout(700);
  expect(await vuelos(page)).toBe(0);
});
