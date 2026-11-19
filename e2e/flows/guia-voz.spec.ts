import { expect, test, type Page } from "@playwright/test";

import type { SugerenciaServidor } from "../../src/features/omnibox/model/guia";
import { decir, dictarAlgo } from "../helpers/chat";
import {
  agregarAVenta,
  dichas,
  escucharVoz,
  productoReal,
  propuesta,
  simularCobro,
  simularDictados,
  simularFrases,
  simularSugerencias,
} from "../helpers/mock";

/**
 * Fase G2b · la Guía conversa: se le contesta con una frase corta ("6", "con
 * QR", "sí") como si se tocara su botón, y si se le está hablando, contesta
 * hablando. También la revisión silenciosa del borrador.
 *
 * La interpretación, el dictado y la voz están simulados (sin créditos de IA
 * ni parlantes); los productos son los reales de la tienda de prueba. El audio
 * sale del micrófono falso de Chromium.
 */

test.use({
  permissions: ["microphone"],
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
});

const franja = (page: Page) => page.getByTestId("omnibox-guia");
const mesa = (page: Page) => page.getByTestId("omnibox-mesa");
const dinero = (n: number) => n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

test.describe("contestarle a la Guía escribiendo", () => {
  test('"6" contesta "¿cuántas?" sin ir al servidor', async ({ page, request }) => {
    const coca = await productoReal(request, "coca");
    const pedidos = await simularFrases(page, { "vendé coca": agregarAVenta(coca, 1, { cantidadDicha: false }) });
    await simularSugerencias(page);
    await page.goto("/omnibox");
    await decir(page, "vendé coca");
    await expect(franja(page)).toHaveAttribute("data-codigo", "CANTIDAD_NO_DICHA");

    await decir(page, "6");
    await expect(mesa(page).getByTestId("omnibox-total-venta")).toHaveText(`Bs ${dinero(coca.precio * 6)}`);
    await expect(page.locator('[data-codigo="CANTIDAD_NO_DICHA"]')).toHaveCount(0);
    await expect(page.getByTestId("omnibox-actividad").last()).toContainText("Ahora son 6");
    // "6" no viajó al servidor: era una respuesta.
    expect(pedidos.map((p) => p.texto)).toEqual(["vendé coca"]);
  });

  test('"cobrá" sin método → "con QR" cobra con QR', async ({ page, request }) => {
    const coca = await productoReal(request, "coca");
    await simularFrases(page, {
      "vendé 2 cocas": agregarAVenta(coca, 2),
      "cobrá": propuesta({ intencion: "cobrar" }),
    });
    await simularSugerencias(page);
    const cobros = await simularCobro(page, { total: coca.precio * 2 });
    await page.goto("/omnibox");
    await decir(page, "vendé 2 cocas");
    await decir(page, "cobrá");
    await expect(franja(page)).toHaveAttribute("data-codigo", "FALTA_PAGO");

    await decir(page, "con QR");
    await expect.poll(() => cobros.length).toBe(1);
    expect(cobros[0].postDataJSON().pago).toBe("qr");
  });

  test("una frase larga con una pregunta pendiente no es respuesta: va al servidor", async ({ page, request }) => {
    const coca = await productoReal(request, "coca");
    const aceite = await productoReal(request, "aceite");
    const pedidos = await simularFrases(page, {
      "vendé coca": agregarAVenta(coca, 1, { cantidadDicha: false }),
      "vendé también un aceite vegetal grande": agregarAVenta(aceite, 1),
    });
    await simularSugerencias(page);
    await page.goto("/omnibox");
    await decir(page, "vendé coca");
    await expect(franja(page)).toHaveAttribute("data-codigo", "CANTIDAD_NO_DICHA");
    await decir(page, "vendé también un aceite vegetal grande");
    expect(pedidos.map((p) => p.texto)).toEqual(["vendé coca", "vendé también un aceite vegetal grande"]);
    await expect(mesa(page).getByTestId("omnibox-total-venta")).toHaveText(`Bs ${dinero(coca.precio + aceite.precio)}`);
  });
});

test.describe("la Guía habla cuando se le habla", () => {
  test('dictado: dice lo que hizo y lo que pregunta; "seis" dictado contesta; "Silenciar" la calla', async ({ page, request }) => {
    test.slow(); // tres dictados con el micrófono falso
    const coca = await productoReal(request, "coca");
    const aceite = await productoReal(request, "aceite");
    await escucharVoz(page);
    await simularSugerencias(page);
    await simularDictados(page, [
      { texto: "vendé coca", propuesta: agregarAVenta(coca, 1, { cantidadDicha: false }) },
      // El servidor no entiende "seis" sola; la Guía sí sabe qué preguntó.
      { texto: "seis", propuesta: null },
      { texto: "vendé un aceite", propuesta: agregarAVenta(aceite, 1) },
    ]);
    await page.goto("/omnibox");

    await dictarAlgo(page);
    await expect.poll(() => dichas(page)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Agregado a la venta, 1 .+bolivianos$/),
        `No dijiste cuántas de ${coca.nombre}: puse 1. ¿Son más? Di cuántas.`,
      ]),
    );
    await expect(page.getByTestId("omnibox-voz-respuestas")).toContainText("Te contesto hablando");

    // Al volver a dictar, la voz se calla (no le tapa el micrófono a nadie).
    const calladasAntes = await page.evaluate(() => (window as any).__calladas as number);
    await dictarAlgo(page);
    expect(await page.evaluate(() => (window as any).__calladas as number)).toBeGreaterThan(calladasAntes);
    await expect(mesa(page).getByTestId("omnibox-total-venta")).toHaveText(`Bs ${dinero(coca.precio * 6)}`);
    await expect.poll(() => dichas(page)).toContain("Ahora son 6");

    // Silenciada, ya no habla aunque se le dicte.
    await page.getByTestId("omnibox-voz-respuestas").getByRole("button", { name: "Silenciar" }).click();
    await expect(page.getByTestId("omnibox-voz-respuestas")).toContainText("Respuestas habladas apagadas");
    const antes = (await dichas(page)).length;
    await dictarAlgo(page);
    await expect(mesa(page).getByTestId("omnibox-total-venta")).toHaveText(`Bs ${dinero(coca.precio * 6 + aceite.precio)}`);
    await page.waitForTimeout(500);
    expect((await dichas(page)).length).toBe(antes);
  });

  test("escribiendo, la Guía no habla", async ({ page, request }) => {
    const coca = await productoReal(request, "coca");
    await escucharVoz(page);
    await simularSugerencias(page);
    await simularFrases(page, { "vendé coca": agregarAVenta(coca, 1, { cantidadDicha: false }) });
    await page.goto("/omnibox");
    await decir(page, "vendé coca");
    await expect(franja(page)).toHaveAttribute("data-codigo", "CANTIDAD_NO_DICHA");
    await page.waitForTimeout(500);
    expect(await dichas(page)).toEqual([]);
    await expect(page.getByTestId("omnibox-voz-respuestas")).toHaveCount(0);
  });
});

test.describe("la revisión silenciosa del borrador", () => {
  test('se pide en el modo aprendiz y su observación se resuelve con "sí"', async ({ page, request }) => {
    const coca = await productoReal(request, "coca");
    const revision: SugerenciaServidor = {
      codigo: "REVISION",
      mesa: "venta",
      texto: `${coca.nombre} parece cargada por error.`,
      campo: `cantidad:${coca.productId}`,
      acciones: [
        { tipo: "cantidad", mesa: "venta", productId: coca.productId, cantidad: 0, etiqueta: "Sacarlo" },
        { tipo: "descartar", etiqueta: "Está bien así" },
      ],
      confianza: 0.85,
      clave: `REVISION:${coca.productId}:quitar:`,
    };
    const pedidos: { revisar?: boolean }[] = [];
    await page.route("**/api/omnibox/sugerencias/evento", (route) => route.fulfill({ json: { statusCode: 200, data: null } }));
    await page.route("**/api/omnibox/sugerencias", async (route) => {
      const body = route.request().postDataJSON();
      pedidos.push(body);
      return route.fulfill({ json: { statusCode: 200, data: body.mesa === "venta" ? [revision] : [] } });
    });
    await simularFrases(page, { "vendé 2 cocas": agregarAVenta(coca, 2) });
    await page.goto("/omnibox");
    await decir(page, "vendé 2 cocas");

    await expect(franja(page)).toHaveAttribute("data-codigo", "REVISION");
    await expect(franja(page)).toContainText("parece cargada por error");
    // Memoria nueva = modo aprendiz: se pidió la revisión.
    expect(pedidos.some((p) => p.revisar === true)).toBe(true);

    await decir(page, "sí");
    await expect(mesa(page).locator(`[data-linea="venta:${coca.productId}"]`)).toHaveCount(0);
    await expect(page.getByTestId("omnibox-actividad").last()).toContainText("Lo saqué");
  });
});
