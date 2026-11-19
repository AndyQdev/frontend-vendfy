import { expect, test, type Page } from "@playwright/test";

import { decir } from "../helpers/chat";
import { API_URL, COMERCIO_EMAIL, COMERCIO_PASSWORD, TIENDA } from "../helpers/env";
import { agregarAVenta, productoReal, propuesta, simularCobro, simularFrases, simularSugerencias } from "../helpers/mock";

/**
 * Fase G2a · sugerencias: la Guía propone lo útil, con el botón que lo
 * resuelve, y no molesta (no vuelve tras un "no, gracias", no interrumpe
 * mientras se escribe, y cede ante un error).
 *
 * La interpretación y las sugerencias del servidor están simuladas; la
 * última prueba llama al servidor de verdad para comprobar sus reglas con
 * los datos reales de la tienda de prueba.
 */

const franja = (page: Page) => page.getByTestId("omnibox-guia");
const dinero = (n: number) => n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

test.describe('"no dijiste cuántas"', () => {
  test("vendé coca sin cantidad: pregunta con números y tocar 6 lo resuelve", async ({ page, request }) => {
    const coca = await productoReal(request, "coca");
    await simularFrases(page, { "vendé coca": agregarAVenta(coca, 1, { cantidadDicha: false }) });
    const eventos = await simularSugerencias(page);
    await page.goto("/omnibox");
    await decir(page, "vendé coca");

    await expect(franja(page)).toHaveAttribute("data-codigo", "CANTIDAD_NO_DICHA");
    await expect(franja(page)).toHaveAttribute("data-nivel", "sugerencia");
    await expect(franja(page)).toContainText(`No dijiste cuántas de ${coca.nombre}`);

    await franja(page).getByTestId("omnibox-guia-accion").filter({ hasText: /^6$/ }).click();
    const mesa = page.getByTestId("omnibox-mesa");
    await expect(mesa.getByTestId("omnibox-total-venta")).toHaveText(`Bs ${dinero(coca.precio * 6)}`);
    await expect(page.locator('[data-codigo="CANTIDAD_NO_DICHA"]')).toHaveCount(0);
    await expect.poll(() => eventos).toEqual(
      expect.arrayContaining([
        { codigo: "CANTIDAD_NO_DICHA", evento: "mostrada" },
        { codigo: "CANTIDAD_NO_DICHA", evento: "aceptada" },
      ]),
    );
  });

  test("si la frase dijo cuántas, no pregunta", async ({ page, request }) => {
    const coca = await productoReal(request, "coca");
    await simularFrases(page, { "vendé 2 cocas": agregarAVenta(coca, 2, { cantidadDicha: true }) });
    await simularSugerencias(page);
    await page.goto("/omnibox");
    await decir(page, "vendé 2 cocas");
    await page.waitForTimeout(1600); // más que la espera de las sugerencias
    await expect(page.locator('[data-codigo="CANTIDAD_NO_DICHA"]')).toHaveCount(0);
  });
});

test.describe("sugerencias del servidor", () => {
  async function conQuedaPoco(page: Page, request: Parameters<typeof productoReal>[0]) {
    const aceite = await productoReal(request, "aceite");
    const queda = {
      codigo: "QUEDA_POCO",
      mesa: "venta",
      texto: `Después de esta venta te quedan 2 de ${aceite.nombre}.`,
      acciones: [
        { tipo: "comprar", producto: aceite, cantidad: 12, costo: 15, costoAnterior: 15, etiqueta: "Anotar para comprar" },
        { tipo: "descartar", etiqueta: "Ahora no" },
      ],
      confianza: 0.7,
      clave: `QUEDA_POCO:${aceite.productId}`,
    };
    await simularFrases(page, {
      "vendé un aceite": agregarAVenta(aceite, 1, { cantidadDicha: true }),
      "que sean 2": propuesta({
        intencion: "cambiar_cantidad_venta",
        entidades: { productId: aceite.productId, producto: aceite.nombre, cantidad: 2, mesa: "venta" },
      }),
    });
    const eventos = await simularSugerencias(page, { venta: [queda] });
    return { aceite, eventos };
  }

  test("llega cuando la venta se queda quieta, y su botón abre la compra con el producto", async ({ page, request }) => {
    const { aceite, eventos } = await conQuedaPoco(page, request);
    await page.goto("/omnibox");
    await decir(page, "vendé un aceite");

    await expect(franja(page)).toHaveAttribute("data-codigo", "QUEDA_POCO", { timeout: 6000 });
    await franja(page).getByTestId("omnibox-guia-accion").filter({ hasText: "Anotar para comprar" }).click();

    const mesa = page.getByTestId("omnibox-mesa");
    await expect(mesa).toHaveAttribute("data-mesa", "compra");
    await expect(page.getByTestId("omnibox-linea-compra")).toHaveCount(1);
    await expect(mesa.getByLabel(`Costo de ${aceite.nombre}`)).toHaveValue("15");
    await expect(mesa.getByRole("spinbutton", { name: `Cantidad de ${aceite.nombre}` }).first()).toHaveValue("12");
    // La venta no se tocó: sigue en el chip.
    await expect(page.getByTestId("omnibox-chip-mesa")).toHaveText(/Venta en curso · 1/);
    expect(eventos).toContainEqual({ codigo: "QUEDA_POCO", evento: "aceptada" });
  });

  test('"Ahora no": se va y no vuelve aunque el servidor la siga calculando', async ({ page, request }) => {
    const { eventos } = await conQuedaPoco(page, request);
    await page.goto("/omnibox");
    await decir(page, "vendé un aceite");
    await expect(franja(page)).toHaveAttribute("data-codigo", "QUEDA_POCO", { timeout: 6000 });

    await franja(page).getByTestId("omnibox-guia-descartar").click();
    await expect(franja(page)).toHaveCount(0);

    // Otro cambio: el servidor vuelve a mandar la misma; la pantalla no la muestra.
    await decir(page, "que sean 2");
    await page.waitForTimeout(1800);
    await expect(page.locator('[data-codigo="QUEDA_POCO"]')).toHaveCount(0);
    expect(eventos).toContainEqual({ codigo: "QUEDA_POCO", evento: "descartada" });
  });

  test("no interrumpe: mientras se escribe se esconde, y vuelve al borrar", async ({ page, request }) => {
    await conQuedaPoco(page, request);
    await page.goto("/omnibox");
    await decir(page, "vendé un aceite");
    await expect(franja(page)).toHaveAttribute("data-codigo", "QUEDA_POCO", { timeout: 6000 });

    const campo = page.getByLabel("Qué necesitas");
    await campo.fill("sumá");
    await expect(franja(page)).toHaveCount(0);
    await campo.fill("");
    await expect(franja(page)).toHaveAttribute("data-codigo", "QUEDA_POCO");
  });

  test("un error tiene prioridad sobre una sugerencia", async ({ page, request }) => {
    const { aceite } = await conQuedaPoco(page, request);
    await simularCobro(page, { total: aceite.precio });
    await page.goto("/omnibox");
    await decir(page, "vendé un aceite");
    await expect(franja(page)).toHaveAttribute("data-codigo", "QUEDA_POCO", { timeout: 6000 });

    await page.getByTestId("omnibox-mesa").getByTestId("omnibox-cobrar").click();
    await expect(franja(page)).toHaveAttribute("data-codigo", "FALTA_PAGO");
    await expect(franja(page)).toHaveCount(1);
  });
});

test.describe("modo aprendiz", () => {
  test("cambiar la cantidad tocando enseña que se puede decir; el tip sale una sola vez", async ({ page, request }) => {
    const aceite = await productoReal(request, "aceite");
    await simularFrases(page, { "vendé un aceite": agregarAVenta(aceite, 1, { cantidadDicha: true }) });
    await simularSugerencias(page);
    await page.goto("/omnibox");
    await decir(page, "vendé un aceite");

    const mas = page.getByTestId("omnibox-mesa").getByRole("button", { name: "Uno más" }).filter({ visible: true });
    await mas.click();
    await expect(franja(page)).toHaveAttribute("data-codigo", "TIP_DECIR_CANTIDAD");
    await franja(page).getByTestId("omnibox-guia-descartar").click(); // "Entendido"
    await expect(franja(page)).toHaveCount(0);

    await mas.click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-codigo="TIP_DECIR_CANTIDAD"]')).toHaveCount(0);
  });
});

test("sin stock: 'Cargar compra' abre la compra con lo que falta y el último costo (D3)", async ({ page, request }) => {
  const aceite = await productoReal(request, "aceite");
  const pedido = Number(aceite.stock) + 4;
  await simularFrases(page, { [`vendé ${pedido} aceites`]: agregarAVenta(aceite, pedido, { cantidadDicha: true }) });
  await simularSugerencias(page);
  await page.goto("/omnibox");
  await decir(page, `vendé ${pedido} aceites`);

  await expect(franja(page)).toHaveAttribute("data-codigo", "SIN_STOCK");
  await franja(page).getByTestId("omnibox-guia-accion").filter({ hasText: "Cargar compra" }).click();

  const mesa = page.getByTestId("omnibox-mesa");
  await expect(mesa).toHaveAttribute("data-mesa", "compra");
  await expect(mesa.getByRole("spinbutton", { name: `Cantidad de ${aceite.nombre}` }).first()).toHaveValue("4");
  // El costo sale de la última compra real (no queda en cero).
  await expect(mesa.getByLabel(`Costo de ${aceite.nombre}`)).not.toHaveValue("0");
});

test("el servidor de verdad: con lo que queda del aceite, sugiere anotarlo para comprar", async ({ request }) => {
  const login = await request.post(`${API_URL}/api/auth/login`, { data: { email: COMERCIO_EMAIL, password: COMERCIO_PASSWORD } });
  const h = { Authorization: `Bearer ${(await login.json()).data.accessToken}` };
  const aceite = await productoReal(request, "aceite");
  test.skip(Number(aceite.stock) < 2, "hace falta stock de aceite para esta prueba");

  const r = await request.post(`${API_URL}/api/omnibox/sugerencias`, {
    headers: h,
    data: { storeId: TIENDA.id, mesa: "venta", lineas: [{ productId: aceite.productId, cantidad: Number(aceite.stock) - 1, precio: aceite.precio }] },
  });
  expect(r.ok()).toBe(true);
  const sugerencias = (await r.json()).data as { codigo: string; acciones: { tipo: string }[] }[];
  const queda = sugerencias.find((s) => s.codigo === "QUEDA_POCO");
  expect(queda, JSON.stringify(sugerencias)).toBeTruthy();
  expect(queda!.acciones[0].tipo).toBe("comprar");

  const ev = await request.post(`${API_URL}/api/omnibox/sugerencias/evento`, {
    headers: h,
    data: { storeId: TIENDA.id, codigo: "QUEDA_POCO", evento: "mostrada" },
  });
  expect(ev.ok()).toBe(true);
});
