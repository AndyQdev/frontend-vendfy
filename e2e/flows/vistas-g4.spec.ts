import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import type { ProductoOpcion, VistaSpec } from "../../src/entities/omnibox/model/types";
import { alertaDe, comparar, etiquetaPeriodo } from "../../src/features/omnibox/model/vistas";
import { decir, ultimaRespuesta } from "../helpers/chat";
import {
  analizar,
  fuenteReal,
  limpiarFijadas,
  productoReal,
  propuesta,
  simularConclusion,
  simularFrases,
  simularSugerencias,
} from "../helpers/mock";

/**
 * Fase G4 · conversar con la vista: cambiarla con una frase, las piezas
 * nuevas (alerta, comparativa, "Reponer"), fijarla en el tablero y
 * exportarla. La IA está simulada; los datos y las vistas fijadas, no.
 */

const dinero = (n: number) => n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const panel = (page: Page) => page.getByTestId("omnibox-mesa");
const pieza = (page: Page, tipo: string, fuente?: string) =>
  panel(page).locator(`[data-testid="vista-pieza"][data-tipo="${tipo}"]${fuente ? `[data-fuente="${fuente}"]` : ""}`);
const ANIO = { periodo: "este_anio" };

// ------------------------------------------------------------ el puente a N1

test.describe('"Reponer estos 3" (el puente a la compra)', () => {
  /** Tres productos reales con poco stock: la fuente simulada, los productos de verdad. */
  async function conPocoStock(page: Page, request: Parameters<typeof productoReal>[0]) {
    const productos = await Promise.all(["coca", "aceite", "arroz"].map((b) => productoReal(request, b)));
    const reponer = [
      { producto: productos[0], sugerido: 18, costo: 8 },
      { producto: productos[1], sugerido: 6, costo: 5 },
      { producto: productos[2], sugerido: 12, costo: 12 },
    ];
    const fila = (r: { producto: ProductoOpcion; sugerido: number; costo: number }) => ({
      producto: r.producto.nombre,
      _imagen: r.producto.imagen,
      _productId: r.producto.productId,
      _storeProductId: r.producto.storeProductId,
      _precio: r.producto.precio,
      _stock: 2,
      stock: 2,
      vendidas30: 20,
      dias: 3,
      _costo: r.costo,
      _sugerido: r.sugerido,
    });
    await page.route("**/api/omnibox/vista/fuente", async (route) => {
      if (route.request().postDataJSON()?.fuente !== "stock_bajo") return route.continue();
      return route.fulfill({
        json: {
          statusCode: 200,
          data: {
            columnas: [
              { clave: "producto", titulo: "Producto", tipo: "producto" },
              { clave: "stock", titulo: "Stock", tipo: "numero" },
              { clave: "vendidas30", titulo: "Vendidas (30 días)", tipo: "numero" },
              { clave: "dias", titulo: "Alcanza para (días)", tipo: "numero" },
            ],
            filas: reponer.map(fila),
          },
        },
      });
    });
    return reponer;
  }

  const PREGUNTA = "productos con poco stock que más se venden";
  const VISTA: VistaSpec = {
    titulo: "Lo que se está por acabar",
    piezas: [
      { id: "p1", tipo: "alerta", fuente: "stock_bajo", params: { limite: 3 } },
      { id: "p2", tipo: "tabla", fuente: "stock_bajo", params: { limite: 3 }, titulo: "Poco stock" },
      { id: "p3", tipo: "accion", accion: "reponer", fuente: "stock_bajo", params: { limite: 3 }, titulo: "Reponer estos" },
      { id: "p4", tipo: "conclusion" },
    ],
  };

  test('tocar "Reponer estos 3" abre la compra con los tres cargados (y no registra nada)', async ({ page, request }) => {
    const reponer = await conPocoStock(page, request);
    await simularFrases(page, { [PREGUNTA]: analizar(VISTA) });
    await simularConclusion(page, "Tres productos se acaban esta semana.");
    await simularSugerencias(page);
    const compras: string[] = [];
    page.on("request", (r) => r.url().includes("/api/omnibox/compras") && compras.push(r.method()));
    await page.goto("/omnibox");
    await decir(page, PREGUNTA);

    // La alerta, con la regla fija sobre esos datos.
    await expect(pieza(page, "alerta")).toHaveAttribute("data-nivel", "advertencia");
    await expect(pieza(page, "alerta")).toContainText("3 productos se acaban esta semana");

    const accion = pieza(page, "accion");
    await expect(accion.getByTestId("vista-reponer-item")).toHaveCount(3);
    await accion.getByRole("button", { name: "Reponer estos 3" }).click();

    // La compra abierta, con cada producto, su cantidad sugerida y su último costo.
    await expect(panel(page)).toHaveAttribute("data-mesa", "compra");
    await expect(panel(page).getByTestId("omnibox-linea-compra")).toHaveCount(3);
    for (const r of reponer) {
      await expect(panel(page).locator(`[data-linea="compra:${r.producto.productId}"]`)).toBeVisible();
    }
    const total = reponer.reduce((s, r) => s + r.sugerido * r.costo, 0);
    await expect(panel(page).getByTestId("omnibox-total-compra")).toHaveText(`Bs ${dinero(total)}`);

    // No se registró nada: eso sigue siendo un toque de la persona.
    expect(compras).toEqual([]);
    // Y la Guía no lo toma por "cargaste 3 a mano: probá la foto de la factura".
    await expect(page.locator('[data-codigo="TIP_FOTO_FACTURA"]')).toHaveCount(0);

    // Volver al análisis: la pieza ve que ya están en la compra (no ofrece cargarlos dos veces)…
    await panel(page).getByRole("tab", { name: /Análisis/ }).click();
    await expect(pieza(page, "accion").getByTestId("vista-reponer-hecho")).toBeVisible();
    await expect(pieza(page, "accion").getByTestId("vista-reponer-boton")).toHaveCount(0);
    // …y si se saca uno de la compra, "Reponer" vuelve.
    await pieza(page, "accion").getByRole("button", { name: "Ver la compra" }).click();
    await panel(page).locator(`[data-linea="compra:${reponer[0].producto.productId}"]`).getByRole("button", { name: /Quitar|Sacar/ }).first().click();
    await panel(page).getByRole("tab", { name: /Análisis/ }).click();
    await expect(pieza(page, "accion").getByTestId("vista-reponer-boton")).toBeVisible();
  });
});

// ------------------------------------------------------------ conversar con la vista

test.describe("conversar con la vista", () => {
  const A: VistaSpec = {
    titulo: "Cómo vamos este año",
    piezas: [
      { id: "p1", tipo: "indicadores", fuente: "kpis", params: ANIO },
      { id: "p2", tipo: "ranking", fuente: "top_productos", params: { ...ANIO, limite: 5, orden: "monto" }, etiqueta: "producto", valor: "monto", titulo: "Lo que más se vendió" },
      { id: "p3", tipo: "conclusion" },
    ],
  };
  const B: VistaSpec = {
    titulo: "Cómo vamos este año, por categoría",
    piezas: [
      { id: "p1", tipo: "indicadores", fuente: "kpis", params: ANIO },
      { id: "p2", tipo: "grafico", forma: "barras", fuente: "ventas_por_categoria", params: ANIO, x: "categoria", y: ["monto"], titulo: "Por categoría" },
      { id: "p3", tipo: "conclusion" },
    ],
  };

  test('"ahora por categoría" cambia la vista que está en pantalla y la tarjeta dice qué cambió', async ({ page }) => {
    const pedidos = await simularFrases(page, {
      "cómo vamos este año": analizar(A),
      "ahora por categoría": propuesta({ intencion: "cambiar_vista", titulo: B.titulo, capa: "C2", vista: B }),
    });
    const conclusiones = await simularConclusion(page, "Este año vendiste poco.");
    await page.goto("/omnibox");
    await decir(page, "cómo vamos este año");
    await expect(panel(page).getByTestId("vista-titulo")).toHaveText(A.titulo);
    await decir(page, "ahora por categoría");

    // La segunda frase viajó con la vista que estaba a la vista.
    expect(pedidos[0].contexto?.enPantalla).toBeUndefined();
    expect(pedidos[1].contexto?.enPantalla).toBe("analisis");
    expect(pedidos[1].contexto?.vista?.titulo).toBe(A.titulo);

    await expect(panel(page).getByTestId("vista-titulo")).toHaveText(B.titulo);
    await expect(pieza(page, "grafico", "ventas_por_categoria")).toBeVisible();
    const cambios = ultimaRespuesta(page).getByTestId("vista-cambios");
    await expect(cambios).toContainText("Saqué: Lo que más se vendió");
    await expect(cambios).toContainText("Agregué: Por categoría");

    // La conclusión de la nueva sabe de qué se venía hablando.
    await expect.poll(() => conclusiones.length).toBe(2);
    expect(conclusiones[1].pregunta).toBe("cómo vamos este año → ahora por categoría");

    // La versión anterior sigue en su tarjeta.
    await page.getByTestId("tarjeta-vista").first().locator("..").getByTestId("vista-abrir").click();
    await expect(panel(page).getByTestId("vista-titulo")).toHaveText(A.titulo);
  });

  test("alerta, comparativa y productos tocables, con los datos reales", async ({ page, request }) => {
    test.slow();
    const VISTA: VistaSpec = {
      titulo: "Este año contra el mes pasado",
      piezas: [
        { id: "p1", tipo: "alerta", fuente: "kpis", params: ANIO },
        {
          id: "p2",
          tipo: "comparativa",
          fuente: "ventas_por_categoria",
          params: {},
          periodos: ["este_anio", "mes_pasado"],
          etiqueta: "categoria",
          valor: "monto",
          titulo: "Por categoría",
        },
        { id: "p3", tipo: "ranking", fuente: "top_productos", params: { ...ANIO, limite: 5, orden: "monto" }, etiqueta: "producto", valor: "monto", titulo: "Lo que más se vendió" },
      ],
    };
    const [kpis, anio, mes, top] = await Promise.all([
      fuenteReal(request, "kpis", ANIO),
      fuenteReal(request, "ventas_por_categoria", ANIO),
      fuenteReal(request, "ventas_por_categoria", { periodo: "mes_pasado" }),
      fuenteReal(request, "top_productos", { ...ANIO, limite: 5, orden: "monto" }),
    ]);
    await simularFrases(page, { "comparame": analizar(VISTA) });
    await page.goto("/omnibox");
    await decir(page, "comparame");

    // La alerta dice lo que dice la regla sobre los datos reales.
    const esperada = alertaDe("kpis", kpis)!;
    await expect(pieza(page, "alerta")).toContainText(esperada.texto);
    await expect(pieza(page, "alerta")).toHaveAttribute("data-nivel", esperada.nivel);

    // La comparativa: cada categoría con sus dos montos.
    const filas = comparar(anio.filas, mes.filas, "categoria", "monto");
    const comparativa = pieza(page, "comparativa");
    await expect(comparativa).toContainText(`${etiquetaPeriodo("este_anio")} vs. ${etiquetaPeriodo("mes_pasado")}`);
    await expect(comparativa.getByTestId("vista-comparada")).toHaveCount(Math.min(8, filas.length));
    await expect(comparativa.getByTestId("vista-comparada").first()).toContainText(filas[0].etiqueta);
    await expect(comparativa.getByTestId("vista-comparada").first()).toContainText(`Bs ${dinero(filas[0].a)}`);

    // Tocar un producto del ranking abre su ficha en el panel.
    const primero = String(top.filas[0].producto);
    await pieza(page, "ranking").getByTestId("vista-producto").filter({ hasText: primero }).click();
    await expect(panel(page)).not.toHaveAttribute("data-mesa", "analisis");
    await expect(panel(page).locator("header")).toContainText(primero);
  });
});

// ------------------------------------------------------------ el tablero y exportar

test.describe("fijar y exportar", () => {
  // Varias cargas de página contra el backend real: más tiempo que el de una prueba común.
  test.slow();
  const NOMBRE = "E2E · Cómo vamos este año";
  const VISTA: VistaSpec = {
    titulo: NOMBRE,
    piezas: [
      { id: "p1", tipo: "indicadores", fuente: "kpis", params: ANIO },
      { id: "p2", tipo: "ranking", fuente: "top_productos", params: { ...ANIO, limite: 5, orden: "monto" }, etiqueta: "producto", valor: "monto", titulo: "Lo que más se vendió" },
      { id: "p3", tipo: "conclusion" },
    ],
  };
  test.beforeEach(async ({ request }) => limpiarFijadas(request, "E2E"));
  test.afterEach(async ({ request }) => limpiarFijadas(request, "E2E"));

  test("fijada, aparece en tu tablero al entrar y se abre con los datos al día, sin IA", async ({ page }) => {
    const pedidos = await simularFrases(page, { "cómo vamos este año": analizar(VISTA) });
    await simularConclusion(page, "Vendiste poco.");
    await page.goto("/omnibox");
    await decir(page, "cómo vamos este año");

    const fijar = panel(page).getByTestId("vista-fijar");
    await expect(fijar).toHaveAttribute("aria-pressed", "false");
    await fijar.click();
    await expect(fijar).toHaveAttribute("aria-pressed", "true");

    // Al volver a entrar, está en el tablero.
    await page.goto("/omnibox");
    const tablero = page.getByTestId("omnibox-tablero");
    await expect(tablero.getByTestId("vista-fijada").filter({ hasText: NOMBRE })).toBeVisible();
    const antes = pedidos.length;
    await tablero.getByTestId("vista-fijada").filter({ hasText: NOMBRE }).click();

    await expect(panel(page).getByTestId("vista-titulo")).toHaveText(NOMBRE);
    await expect(ultimaRespuesta(page)).toContainText("De tu tablero");
    await expect(panel(page).getByTestId("vista-indicador").first()).toBeVisible();
    expect(pedidos.length).toBe(antes); // no pasó por la IA

    // Sacarla del tablero.
    await expect(panel(page).getByTestId("vista-fijar")).toHaveAttribute("aria-pressed", "true");
    await panel(page).getByTestId("vista-fijar").click();
    await expect(panel(page).getByTestId("vista-fijar")).toHaveAttribute("aria-pressed", "false");
    await page.goto("/omnibox");
    await expect(page.getByTestId("vista-fijada").filter({ hasText: NOMBRE })).toHaveCount(0);
  });

  test("Excel: un .xlsx con el resumen y una hoja por pieza, con los datos y la conclusión", async ({ page, request }) => {
    const top = await fuenteReal(request, "top_productos", { ...ANIO, limite: 5, orden: "monto" });
    await simularFrases(page, { "cómo vamos este año": analizar(VISTA) });
    await simularConclusion(page, "Este año vendiste poco.");
    await page.goto("/omnibox");
    await decir(page, "cómo vamos este año");
    await expect(panel(page).getByTestId("vista-conclusion")).toHaveAttribute("data-estado", "lista");

    await panel(page).getByTestId("vista-exportar").click();
    const [descarga] = await Promise.all([page.waitForEvent("download"), page.getByTestId("vista-exportar-excel").click()]);
    expect(descarga.suggestedFilename()).toMatch(/^e2e-como-vamos-este-ano-\d{4}-\d{2}-\d{2}\.xlsx$/);
    const bytes = readFileSync((await descarga.path())!);
    // Un zip ("PK") sin compresión: el contenido se puede buscar como texto.
    expect(bytes.subarray(0, 2).toString("latin1")).toBe("PK");
    const texto = bytes.toString("utf8");
    for (const parte of ["xl/workbook.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet3.xml"]) expect(texto).toContain(parte);
    expect(texto).toContain("Este año vendiste poco.");
    expect(texto).toContain(String(top.filas[0].producto).replace(/&/g, "&amp;"));
    await descarga.saveAs(`${test.info().outputDir}/vista.xlsx`);
  });

  test("PDF: la vista sola en una ventana limpia, sin botones, y se manda a imprimir", async ({ page }) => {
    await simularFrases(page, { "cómo vamos este año": analizar(VISTA) });
    await simularConclusion(page, "Este año vendiste poco.");
    await page.goto("/omnibox");
    await decir(page, "cómo vamos este año");
    await expect(panel(page).getByTestId("vista-puesto").first()).toBeVisible();
    // La impresión se intercepta: en una prueba no hay a quién mostrarle el cuadro.
    await page.evaluate(() => {
      const abrir = window.open.bind(window);
      window.open = (...args: Parameters<typeof window.open>) => {
        const w = abrir(...args);
        if (w) w.print = () => ((window as any).__impreso = true);
        return w;
      };
    });

    await panel(page).getByTestId("vista-exportar").click();
    const [ventana] = await Promise.all([page.waitForEvent("popup"), page.getByTestId("vista-exportar-pdf").click()]);
    await expect(ventana.locator("h1")).toHaveText(NOMBRE);
    await expect(ventana.getByTestId("vista-pieza").first()).toBeVisible();
    await expect(ventana.getByTestId("vista-conclusion")).toContainText("Este año vendiste poco.");
    expect(await ventana.locator("[data-no-imprimir]").count()).toBe(0);
    await expect.poll(() => page.evaluate(() => (window as any).__impreso === true)).toBe(true);
  });
});
