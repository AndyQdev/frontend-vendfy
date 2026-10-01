import { expect, test, type Page } from "@playwright/test";

import type { VistaSpec } from "../../src/entities/omnibox/model/types";
import { decir, ultimaRespuesta } from "../helpers/chat";
import { analizar, fuenteReal, simularConclusion, simularFrases } from "../helpers/mock";

/**
 * Fase G3 · vistas: una pregunta de análisis se responde con una vista que
 * arma la IA con piezas de un catálogo, y los números salen de la base.
 *
 * Lo que escribe la IA (qué piezas, la conclusión) está simulado: no gasta
 * créditos y no cambia entre corridas. Los DATOS no: cada pieza lee su
 * fuente real del backend, y la prueba compara lo que se ve con lo que
 * devuelve la fuente.
 */

const PREGUNTA = "cómo vamos este año";
const ANIO = { periodo: "este_anio" };

const VISTA: VistaSpec = {
  titulo: "Cómo vamos este año",
  piezas: [
    { id: "p1", tipo: "indicadores", fuente: "kpis", params: ANIO },
    {
      id: "p2",
      tipo: "grafico",
      forma: "barras",
      fuente: "ventas_en_el_tiempo",
      params: { ...ANIO, agrupar: "mes" },
      x: "fecha",
      y: ["ventas"],
      titulo: "Ventas por mes",
    },
    {
      id: "p3",
      tipo: "ranking",
      fuente: "top_productos",
      params: { ...ANIO, limite: 5, orden: "monto" },
      etiqueta: "producto",
      valor: "monto",
      titulo: "Lo que más se vendió",
    },
    { id: "p4", tipo: "grafico", forma: "torta", fuente: "ventas_por_pago", params: ANIO, x: "metodo", y: ["monto"], titulo: "Cómo pagan" },
    { id: "p5", tipo: "conclusion" },
  ],
};

const dinero = (n: unknown) =>
  Number(n).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const panel = (page: Page) => page.getByTestId("omnibox-mesa");
const pieza = (page: Page, fuente: string) => panel(page).locator(`[data-testid="vista-pieza"][data-fuente="${fuente}"]`);

async function preguntar(page: Page, vista = VISTA, conclusion = "Este año la tienda vendió poco: conviene mover el stock quieto.") {
  await simularFrases(page, { [PREGUNTA]: analizar(vista) });
  const pedidos = await simularConclusion(page, conclusion);
  await page.goto("/omnibox");
  await decir(page, PREGUNTA);
  return pedidos;
}

test.describe("una pregunta de análisis", () => {
  test("arma la vista en el panel con los números reales de la tienda", async ({ page, request }) => {
    const [kpis, top, pago] = await Promise.all([
      fuenteReal(request, "kpis", ANIO),
      fuenteReal(request, "top_productos", { ...ANIO, limite: 5, orden: "monto" }),
      fuenteReal(request, "ventas_por_pago", ANIO),
    ]);
    const pedidos = await preguntar(page);

    await expect(panel(page)).toHaveAttribute("data-mesa", "analisis");
    await expect(panel(page).getByTestId("vista-titulo")).toHaveText(VISTA.titulo);

    // Indicadores: todos los de la fuente, con su valor exacto.
    await expect(panel(page).getByTestId("vista-indicador")).toHaveCount(kpis.filas.length);
    const ventas = kpis.filas.find((f) => f.indicador === "Ventas")!;
    await expect(panel(page).locator('[data-indicador="Ventas"]')).toContainText(`Bs ${dinero(ventas.valor)}`);

    // Ranking: el mismo orden y los mismos montos que la base.
    const puestos = pieza(page, "top_productos").getByTestId("vista-puesto");
    await expect(puestos).toHaveCount(Math.min(5, top.filas.length));
    await expect(puestos.first()).toContainText(String(top.filas[0].producto));
    await expect(puestos.first()).toContainText(`Bs ${dinero(top.filas[0].monto)}`);

    // Torta: cada método de pago en la leyenda, con su monto.
    const torta = pieza(page, "ventas_por_pago").getByTestId("vista-torta");
    for (const f of pago.filas) {
      await expect(torta).toContainText(String(f.metodo));
      await expect(torta).toContainText(`Bs ${dinero(f.monto)}`);
    }

    // El gráfico de barras se dibujó: hay barras pintadas (los meses sin ventas no tienen).
    await expect(pieza(page, "ventas_en_el_tiempo").locator(".recharts-bar-rectangle path").first()).toBeVisible();

    // La conclusión, pedida una vez con la pregunta y la vista.
    await expect(panel(page).getByTestId("vista-conclusion")).toContainText("Este año la tienda vendió poco");
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].pregunta).toBe(PREGUNTA);
    expect(pedidos[0].vista.piezas).toHaveLength(VISTA.piezas.length);

    // En el chat queda la tarjeta, marcando que está abierta.
    await expect(ultimaRespuesta(page).getByTestId("tarjeta-vista")).toContainText(VISTA.titulo);
    await expect(ultimaRespuesta(page)).toContainText("Indicadores · Gráfico de barras · Ranking · Gráfico de torta · Conclusión");
    await expect(ultimaRespuesta(page)).toContainText("Abierto en el panel");
  });

  test("cada gráfico tiene su tabla: el mismo dato sin depender del color ni del tooltip", async ({ page, request }) => {
    const top = await fuenteReal(request, "top_productos", { ...ANIO, limite: 5, orden: "monto" });
    await preguntar(page);

    const ranking = pieza(page, "top_productos");
    await expect(ranking.getByTestId("vista-puesto").first()).toBeVisible();
    await ranking.getByTestId("vista-alternar").click();
    const tabla = ranking.getByTestId("vista-tabla");
    await expect(tabla.locator("tbody tr")).toHaveCount(Math.min(8, top.filas.length));
    await expect(tabla.locator("tbody tr").first()).toContainText(String(top.filas[0].producto));
    await expect(tabla.locator("tbody tr").first()).toContainText(`Bs ${dinero(top.filas[0].monto)}`);

    await ranking.getByTestId("vista-alternar").click();
    await expect(ranking.getByTestId("vista-ranking")).toBeVisible();
  });

  test("el período de arriba cambia todas las piezas y la conclusión", async ({ page }) => {
    const pedidosFuente: { fuente: string; params: Record<string, unknown> }[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/omnibox/vista/fuente")) pedidosFuente.push(r.postDataJSON());
    });
    const pedidos = await preguntar(page);
    await expect(panel(page).getByTestId("vista-conclusion")).toHaveAttribute("data-estado", "lista");

    await panel(page).getByTestId("vista-periodo").click();
    await page.getByRole("option", { name: "Hoy" }).click();

    for (const fuente of ["kpis", "ventas_en_el_tiempo", "top_productos", "ventas_por_pago"]) {
      await expect.poll(() => pedidosFuente.some((p) => p.fuente === fuente && p.params.periodo === "hoy")).toBe(true);
      // El subtítulo de cada pieza es el período que devolvió el servidor.
      await expect(pieza(page, fuente).locator("header")).toContainText("Hoy");
    }
    await expect.poll(() => pedidos.length).toBe(2);
    const ultima = pedidos[1].vista;
    expect(ultima.piezas.filter((p) => p.tipo !== "conclusion").every((p) => (p as any).params.periodo === "hoy")).toBe(true);
  });

  test("ir a la venta no pierde el análisis, y volver no vuelve a pedir la conclusión", async ({ page }) => {
    const pedidos = await preguntar(page);
    await expect(panel(page).getByTestId("vista-conclusion")).toHaveAttribute("data-estado", "lista");

    await panel(page).getByRole("tab", { name: /Venta/ }).click();
    await expect(panel(page)).toHaveAttribute("data-mesa", "venta");
    // La tarjeta del chat ofrece volver.
    await ultimaRespuesta(page).getByTestId("vista-abrir").click();
    await expect(panel(page)).toHaveAttribute("data-mesa", "analisis");
    await expect(panel(page).getByTestId("vista-conclusion")).toContainText("Este año la tienda vendió poco");

    // Y también desde su pestaña.
    await panel(page).getByRole("tab", { name: /Compra/ }).click();
    await panel(page).getByRole("tab", { name: /Análisis/ }).click();
    await expect(panel(page).getByTestId("vista-titulo")).toHaveText(VISTA.titulo);
    expect(pedidos).toHaveLength(1);
  });
});

test.describe("cuando algo no sale", () => {
  test("si la IA no pudo armar la vista pedida, la tarjeta lo dice y muestra la de respaldo", async ({ page }) => {
    const aviso = "No pude armar exactamente esa vista: te muestro cómo van las ventas.";
    await simularFrases(page, { [PREGUNTA]: analizar(VISTA, aviso) });
    await simularConclusion(page, "");
    await page.goto("/omnibox");
    await decir(page, PREGUNTA);
    await expect(ultimaRespuesta(page)).toContainText(aviso);
    await expect(panel(page)).toHaveAttribute("data-mesa", "analisis");
  });

  test("una conclusión sin frases verificables no inventa: lo dice", async ({ page }) => {
    await preguntar(page, VISTA, "");
    const conclusion = panel(page).getByTestId("vista-conclusion");
    await expect(conclusion).toHaveAttribute("data-estado", "vacia");
    await expect(conclusion).toContainText("No encontré nada que se pueda afirmar solo con estos números");
  });

  test("una pieza que falla no tumba la vista: muestra su error con Reintentar", async ({ page }) => {
    await page.route("**/api/omnibox/vista/fuente", async (route) => {
      if (route.request().postDataJSON()?.fuente === "ventas_por_pago") {
        return route.fulfill({ status: 500, json: { statusCode: 500, message: "Se cortó la conexión con la base." } });
      }
      return route.continue();
    });
    await preguntar(page);

    await expect(pieza(page, "ventas_por_pago")).toContainText("Se cortó la conexión con la base.");
    await expect(pieza(page, "ventas_por_pago").getByRole("button", { name: "Reintentar" })).toBeVisible();
    await expect(panel(page).getByTestId("vista-indicador").first()).toBeVisible();
    await expect(pieza(page, "top_productos").getByTestId("vista-ranking")).toBeVisible();
  });
});
