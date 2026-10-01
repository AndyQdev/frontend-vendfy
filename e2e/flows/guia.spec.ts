import { expect, test, type Page } from "@playwright/test";

import { decir } from "../helpers/chat";
import { agregarAVenta, productoReal, propuesta, simularCobro, simularFrases } from "../helpers/mock";

/**
 * Fase G0 · la Guía: avisa lo que falta, señala el campo y, cuando se
 * resuelve, termina lo que se estaba haciendo.
 *
 * La interpretación y el cobro están simulados (helpers/mock.ts): se prueba
 * la pantalla, sin gastar créditos de IA ni escribir ventas reales.
 */

const guia = (page: Page) => page.getByTestId("omnibox-guia");

/** El campo marcado está brillando (la clase dura ~2 s). */
async function brilla(page: Page, selector: string) {
  await expect(page.locator(selector).filter({ visible: true }).first()).toHaveClass(/campo-brilla/);
}

test.describe("cobrar", () => {
  test("tocando Cobrar sin método: la Guía lo pide, el campo brilla y elegirlo en la Guía cobra", async ({ page, request }) => {
    const aceite = await productoReal(request, "aceite");
    await simularFrases(page, { "vendé un aceite": agregarAVenta(aceite) });
    const cobros = await simularCobro(page, { total: aceite.precio });

    await page.goto("/omnibox");
    await decir(page, "vendé un aceite");
    const mesa = page.getByTestId("omnibox-mesa");
    await expect(mesa.getByTestId("omnibox-linea-venta")).toHaveCount(1);
    // Arranca sin método: ninguno marcado.
    await expect(mesa.getByRole("radio", { checked: true })).toHaveCount(0);

    await mesa.getByTestId("omnibox-cobrar").click();
    await expect(guia(page)).toHaveAttribute("data-codigo", "FALTA_PAGO");
    await expect(guia(page)).toHaveAttribute("role", "alert");
    await brilla(page, '[data-campo="pago"]');
    await expect(mesa.getByRole("radio", { name: "Efectivo" })).toBeFocused();
    expect(cobros).toHaveLength(0); // no se mandó nada

    await guia(page).getByTestId("omnibox-guia-accion").filter({ hasText: "QR" }).click();
    await expect(page.getByTestId("omnibox-venta").last()).toHaveAttribute("data-estado", "cobrada");
    expect(cobros).toHaveLength(1);
    expect(cobros[0].postDataJSON().pago).toBe("qr");
    await expect(guia(page)).toHaveCount(0);
    await expect(mesa.getByTestId("omnibox-linea-venta")).toHaveCount(0);
  });

  test('diciendo "cobrá" sin método: la frase queda esperando y se cobra al elegir en el panel', async ({ page, request }) => {
    const aceite = await productoReal(request, "aceite");
    await simularFrases(page, {
      "vendé un aceite": agregarAVenta(aceite),
      "cobrá": propuesta({ intencion: "cobrar" }),
    });
    const cobros = await simularCobro(page, { total: aceite.precio });

    await page.goto("/omnibox");
    await decir(page, "vendé un aceite");
    await decir(page, "cobrá");

    // La tarjeta de la frase dice qué falta (ámbar, no la tilde de "hecho").
    const tarjeta = page.getByTestId("omnibox-actividad").last();
    await expect(tarjeta).toHaveAttribute("data-estado", "guia");
    await expect(tarjeta).toContainText("Falta el método de pago");
    await expect(guia(page)).toHaveAttribute("data-codigo", "FALTA_PAGO");

    // Elegirlo en el panel (no en la Guía) también completa el cobro.
    await page.getByTestId("omnibox-mesa").getByRole("radio", { name: "Efectivo" }).click();
    const venta = page.getByTestId("omnibox-venta");
    await expect(venta).toHaveCount(1);
    await expect(venta).toHaveAttribute("data-estado", "cobrada");
    expect(cobros[0].postDataJSON().pago).toBe("efectivo");
    // La venta queda en la tarjeta de la frase "cobrá", no en una nueva.
    await expect(page.getByTestId("omnibox-actividad").filter({ hasText: "Falta el método de pago" })).toHaveCount(0);
  });

  test("con método elegido, cobra sin que la Guía diga nada", async ({ page, request }) => {
    const aceite = await productoReal(request, "aceite");
    await simularFrases(page, { "vendé un aceite": agregarAVenta(aceite) });
    const cobros = await simularCobro(page, { total: aceite.precio });

    await page.goto("/omnibox");
    await decir(page, "vendé un aceite");
    const mesa = page.getByTestId("omnibox-mesa");
    await mesa.getByRole("radio", { name: "Tarjeta" }).click();
    await mesa.getByTestId("omnibox-cobrar").click();
    await expect(page.getByTestId("omnibox-venta")).toHaveAttribute("data-estado", "cobrada");
    expect(cobros[0].postDataJSON().pago).toBe("tarjeta");
    await expect(guia(page)).toHaveCount(0);
  });

  test("el servidor dice que no hay stock: la Guía lo dice, señala la cantidad y calla al corregirla", async ({ page, request }) => {
    const aceite = await productoReal(request, "aceite");
    await simularFrases(page, { "vendé un aceite": agregarAVenta(aceite) });
    await simularCobro(page, {
      status: 400,
      message:
        `No hay stock suficiente de: ${aceite.nombre} (hay 0, se piden 1). ` +
        'Si es un producto que consigues a pedido, habilita "A pedido" para poder venderlo sin stock.',
    });

    await page.goto("/omnibox");
    await decir(page, "vendé un aceite");
    const mesa = page.getByTestId("omnibox-mesa");
    await mesa.getByRole("radio", { name: "QR" }).click();
    await mesa.getByTestId("omnibox-cobrar").click();

    await expect(guia(page)).toHaveAttribute("data-codigo", "SIN_STOCK");
    await expect(guia(page)).toHaveAttribute("data-nivel", "error");
    await expect(guia(page)).toContainText(aceite.nombre);
    await brilla(page, `[data-campo="cantidad:${aceite.productId}"]`);
    // El carrito queda intacto para corregir.
    await expect(mesa.getByTestId("omnibox-linea-venta")).toHaveCount(1);

    await mesa.getByRole("button", { name: "Uno más" }).filter({ visible: true }).click();
    await expect(guia(page)).toHaveCount(0);
  });
});

test.describe("avisos desde el chat", () => {
  test("vender más de lo que hay, hablando: advierte sin bloquear y sin robar el foco", async ({ page, request }) => {
    const aceite = await productoReal(request, "aceite");
    await simularFrases(page, { "vendé 999 aceites": agregarAVenta(aceite, 999) });

    await page.goto("/omnibox");
    await decir(page, "vendé 999 aceites");

    await expect(guia(page)).toHaveAttribute("data-codigo", "SIN_STOCK");
    await expect(guia(page)).toHaveAttribute("data-nivel", "advertencia");
    await expect(guia(page)).toHaveAttribute("role", "status");
    // Una advertencia no señala sola: el foco sigue en el campo del chat.
    await expect(page.getByLabel("Qué necesitás")).toBeFocused();

    await guia(page).getByTestId("omnibox-guia-accion").click(); // "Ver cantidad"
    await brilla(page, `[data-campo="cantidad:${aceite.productId}"]`);
  });

  test("cerrar la Guía la calla", async ({ page, request }) => {
    const aceite = await productoReal(request, "aceite");
    await simularFrases(page, { "vendé 999 aceites": agregarAVenta(aceite, 999) });
    await page.goto("/omnibox");
    await decir(page, "vendé 999 aceites");
    await guia(page).getByRole("button", { name: "Cerrar el aviso" }).click();
    await expect(guia(page)).toHaveCount(0);
  });
});

test.describe("compra", () => {
  test("registrar con renglones de la factura sin resolver: la Guía señala el renglón en el chat", async ({ page, request }) => {
    const coca = await productoReal(request, "coca");
    await page.route("**/api/omnibox/factura", (route) =>
      route.fulfill({
        json: {
          statusCode: 200,
          data: propuesta({
            intencion: "agregar_a_compra",
            entidades: { factura: true, proveedor: "Distribuidora Andina", referencia: "004512", adjunto: null },
            items: [
              { texto: "COCA COLA 2 LT", buscado: "Coca Cola 2L", cantidad: 6, precio: 10.5, producto: coca, opciones: [], noEncontrado: null },
              { texto: "GALLETAS MARIA", buscado: "galletas maria", cantidad: 10, precio: 4.5, producto: null, opciones: [], noEncontrado: "GALLETAS MARIA" },
            ],
            costos: {},
          }),
        },
      }),
    );
    await simularFrases(page, { "registrá la compra": propuesta({ intencion: "registrar_compra" }) });
    let registradas = 0;
    await page.route("**/api/omnibox/compras", (route) => {
      registradas++;
      return route.fulfill({ status: 500, json: { message: "no debería llegar" } });
    });

    await page.goto("/omnibox");
    await page.getByTestId("omnibox-archivo").setInputFiles("e2e/fixtures/factura.png");
    await expect(page.getByTestId("omnibox-renglon-factura")).toHaveCount(2);

    await decir(page, "registrá la compra");
    await page.getByTestId("omnibox-confirmar-compra-chat").click();

    await expect(guia(page)).toHaveAttribute("data-codigo", "RENGLON_SIN_RESOLVER");
    await brilla(page, '[data-campo^="renglon:"][data-campo$=":1"]');
    expect(registradas).toBe(0);
  });
});
