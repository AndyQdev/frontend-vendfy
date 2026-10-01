import { expect, test } from "@playwright/test";

import { decir, ultimaRespuesta } from "../helpers/chat";

/**
 * En el teléfono el panel no entra al costado: sube desde abajo.
 */
test("la ficha sube como hoja y se cierra sin perder la venta", async ({ page }) => {
  await page.goto("/omnibox");
  await decir(page, "cuánto queda de coca");
  await ultimaRespuesta(page).getByTestId("omnibox-fila-stock").first().click();

  const mesa = page.getByTestId("omnibox-mesa");
  await expect(mesa).toBeVisible();
  // Ocupa el ancho de la pantalla: es hoja, no columna.
  const caja = await mesa.boundingBox();
  expect(caja!.width).toBeGreaterThan(page.viewportSize()!.width * 0.9);

  await mesa.getByTestId("omnibox-agregar-venta").click();
  await mesa.getByRole("button", { name: "Cerrar el panel" }).click();

  await expect(page.getByTestId("omnibox-chip-mesa")).toHaveText(/Venta en curso · 1/);
});

test('teléfono: "cobrá" sin método sube la hoja con el método brillando, y elegirlo cobra', async ({ page, request }) => {
  const { agregarAVenta, productoReal, propuesta, simularCobro, simularFrases } = await import("../helpers/mock");
  const aceite = await productoReal(request, "aceite");
  await simularFrases(page, {
    "vendé un aceite": agregarAVenta(aceite),
    "cobrá": propuesta({ intencion: "cobrar" }),
  });
  const cobros = await simularCobro(page, { total: aceite.precio });

  await page.goto("/omnibox");
  await decir(page, "vendé un aceite");
  // En el teléfono el panel no se abre con cada frase: queda el chip.
  await expect(page.getByTestId("omnibox-mesa")).toHaveCount(0);
  await decir(page, "cobrá");

  const mesa = page.getByTestId("omnibox-mesa");
  await expect(mesa).toBeVisible();
  await expect(mesa.locator('[data-campo="pago"]')).toHaveClass(/campo-brilla/);
  await mesa.getByRole("radio", { name: "QR" }).click();

  await expect(page.getByTestId("omnibox-venta")).toHaveAttribute("data-estado", "cobrada");
  expect(cobros[0].postDataJSON().pago).toBe("qr");
});

test("teléfono: con el panel cerrado, lo que se agrega vuela hasta el chip de la venta", async ({ page, request }) => {
  const { agregarAVenta, productoReal, simularFrases } = await import("../helpers/mock");
  const { animaciones, grabarAnimaciones, vuelos } = await import("../helpers/animaciones");
  const aceite = await productoReal(request, "aceite");
  await simularFrases(page, { "vendé un aceite": agregarAVenta(aceite) });
  await page.goto("/omnibox");
  await grabarAnimaciones(page);
  await decir(page, "vendé un aceite");

  await expect(page.getByTestId("omnibox-chip-mesa")).toHaveText(/Venta en curso · 1/);
  await expect.poll(() => vuelos(page)).toBe(1);
  await expect
    .poll(async () => (await animaciones(page)).map((a) => `${a.clase}@${a.en}`))
    .toContain("aterriza@testid:omnibox-chip-mesa");
});

test("teléfono: la sugerencia aparece sobre el campo con el panel cerrado y se resuelve de un toque", async ({ page, request }) => {
  const { agregarAVenta, productoReal, simularFrases, simularSugerencias } = await import("../helpers/mock");
  const coca = await productoReal(request, "coca");
  await simularFrases(page, { "vendé coca": agregarAVenta(coca, 1, { cantidadDicha: false }) });
  await simularSugerencias(page);
  await page.goto("/omnibox");
  await decir(page, "vendé coca");

  const franja = page.getByTestId("omnibox-guia");
  await expect(franja).toHaveAttribute("data-codigo", "CANTIDAD_NO_DICHA");
  await expect(page.getByTestId("omnibox-mesa")).toHaveCount(0); // no abrió la hoja
  await franja.getByTestId("omnibox-guia-accion").filter({ hasText: /^3$/ }).click();
  await expect(franja).toHaveCount(0);

  await page.getByTestId("omnibox-chip-mesa").click();
  await expect(page.getByTestId("omnibox-mesa").getByRole("spinbutton", { name: `Cantidad de ${coca.nombre}` }).first()).toHaveValue("3");
});

test("teléfono: un análisis sube como hoja con la vista, y se vuelve a abrir desde el chat", async ({ page }) => {
  const { analizar, simularConclusion, simularFrases } = await import("../helpers/mock");
  const vista = {
    titulo: "Cómo vamos este año",
    piezas: [
      { id: "p1", tipo: "indicadores" as const, fuente: "kpis" as const, params: { periodo: "este_anio" } },
      {
        id: "p2",
        tipo: "ranking" as const,
        fuente: "top_productos",
        params: { periodo: "este_anio", limite: 5, orden: "monto" },
        etiqueta: "producto",
        valor: "monto",
        titulo: "Lo que más se vendió",
      },
      { id: "p3", tipo: "conclusion" as const },
    ],
  };
  await simularFrases(page, { "cómo vamos este año": analizar(vista) });
  await simularConclusion(page, "Vendiste poco este año.");

  await page.goto("/omnibox");
  await decir(page, "cómo vamos este año");

  // La vista ES la respuesta: en el teléfono también se abre.
  const mesa = page.getByTestId("omnibox-mesa");
  await expect(mesa).toHaveAttribute("data-mesa", "analisis");
  const caja = await mesa.boundingBox();
  expect(caja!.width).toBeGreaterThan(page.viewportSize()!.width * 0.9);
  await expect(mesa.getByTestId("vista-indicador").first()).toBeVisible();
  // Las cuatro pestañas entran (o se desplazan) sin romper el ancho de la hoja.
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(ancho).toBeLessThanOrEqual(page.viewportSize()!.width);

  await mesa.getByRole("button", { name: "Cerrar el panel" }).click();
  await expect(page.getByTestId("omnibox-mesa")).toHaveCount(0);
  await ultimaRespuesta(page).getByTestId("vista-abrir").click();
  await expect(page.getByTestId("omnibox-mesa")).toHaveAttribute("data-mesa", "analisis");
  await expect(page.getByTestId("vista-conclusion")).toContainText("Vendiste poco este año.");
});

test('teléfono: "Reponer" desde el análisis pasa la hoja a la compra cargada', async ({ page, request }) => {
  const { analizar, productoReal, simularConclusion, simularFrases, simularSugerencias } = await import("../helpers/mock");
  const coca = await productoReal(request, "coca");
  await page.route("**/api/omnibox/vista/fuente", async (route) => {
    if (route.request().postDataJSON()?.fuente !== "top_productos") return route.continue();
    return route.fulfill({
      json: {
        statusCode: 200,
        data: {
          columnas: [
            { clave: "producto", titulo: "Producto", tipo: "producto" },
            { clave: "unidades", titulo: "Unidades", tipo: "numero" },
            { clave: "monto", titulo: "Vendido", tipo: "dinero" },
          ],
          filas: [
            {
              producto: coca.nombre,
              _imagen: coca.imagen,
              _productId: coca.productId,
              _storeProductId: coca.storeProductId,
              _precio: coca.precio,
              _stock: coca.stock,
              unidades: 12,
              monto: coca.precio * 12,
              _costo: 7,
              _sugerido: 12,
            },
          ],
        },
      },
    });
  });
  const vista = {
    titulo: "Qué reponer",
    piezas: [
      { id: "p1", tipo: "accion" as const, accion: "reponer" as const, fuente: "top_productos", params: { periodo: "7dias", limite: 5, orden: "monto" }, titulo: "Reponer lo que más sale" },
    ],
  };
  await simularFrases(page, { "qué tengo que reponer": analizar(vista) });
  await simularConclusion(page, "");
  await simularSugerencias(page);

  await page.goto("/omnibox");
  await decir(page, "qué tengo que reponer");
  const mesa = page.getByTestId("omnibox-mesa");
  await expect(mesa).toHaveAttribute("data-mesa", "analisis");
  await mesa.getByRole("button", { name: "Reponer este" }).click();
  await expect(mesa).toHaveAttribute("data-mesa", "compra");
  await expect(mesa.locator(`[data-linea="compra:${coca.productId}"]`)).toBeVisible();
  await expect(mesa.getByTestId("omnibox-total-compra")).toHaveText("Bs 84,00");
});
