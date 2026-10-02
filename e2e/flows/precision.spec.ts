import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import type { ClienteOpcion, VistaSpec } from "../../src/entities/omnibox/model/types";
import { decir, ultimaRespuesta } from "../helpers/chat";
import { API_URL, COMERCIO_EMAIL, COMERCIO_PASSWORD, TIENDA } from "../helpers/env";
import { analizar, propuesta, simularConclusion, simularFrases } from "../helpers/mock";

/**
 * Fase G6b · precisión y memoria: un número que no es lo que se preguntó es
 * peor que no mostrar nada.
 *
 * Lo que entiende el modelo está simulado; los DATOS no: cada pieza filtra en
 * la base de verdad, y la prueba revisa que lo que se ve sea solo de ese
 * cliente. El formulario crea un cliente real y lo borra al terminar.
 */

async function token(request: APIRequestContext) {
  const r = await request.post(`${API_URL}/api/auth/login`, { data: { email: COMERCIO_EMAIL, password: COMERCIO_PASSWORD } });
  return (await r.json()).data.accessToken as string;
}

async function clientes(request: APIRequestContext, q: string): Promise<ClienteOpcion[]> {
  const r = await request.get(`${API_URL}/api/omnibox/clientes?storeId=${TIENDA.id}&q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${await token(request)}` },
  });
  return (await r.json()).data;
}

const panel = (page: Page) => page.getByTestId("omnibox-mesa");
const pedidosDe = (c: { id: string; nombre: string }): VistaSpec => ({
  titulo: `Ventas de ${c.nombre}`,
  filtros: { cliente: { id: c.id, nombre: c.nombre } },
  piezas: [
    { id: "p1", tipo: "indicadores", fuente: "kpis", params: { periodo: "este_anio", cliente: c.id } },
    { id: "p2", tipo: "tabla", fuente: "pedidos", params: { periodo: "este_anio", limite: 30, cliente: c.id }, titulo: "Sus ventas" },
    { id: "p3", tipo: "conclusion" },
  ],
});

test("las ventas de un cliente: la respuesta escrita en el chat, de quién es cada número, y la memoria para seguir", async ({ page, request }) => {
  const [c] = await clientes(request, "andres cabrera");
  const pedidos = await simularFrases(page, {
    "ventas de andrés cabrera": analizar(pedidosDe(c)),
    "y su línea de tiempo": analizar(pedidosDe(c)),
  });
  await simularConclusion(page, `${c.nombre} te compró poco este año: conviene ofrecerle algo nuevo.`);
  await page.goto("/omnibox");
  await decir(page, "ventas de andrés cabrera");

  // La respuesta, escrita en el chat, arriba de la tarjeta; y de quién es.
  await expect(page.getByTestId("vista-respuesta").last()).toHaveText(`${c.nombre} te compró poco este año: conviene ofrecerle algo nuevo.`);
  await expect(page.getByTestId("vista-alcance").first()).toContainText(`Cliente: ${c.nombre}`);
  // En el panel: arriba y en cada pieza.
  await expect(panel(page).getByTestId("vista-alcance")).toContainText(`Cliente: ${c.nombre}`);
  const tabla = panel(page).locator('[data-testid="vista-pieza"][data-fuente="pedidos"]');
  await expect(tabla).toContainText(`Cliente: ${c.nombre}`);
  // Los datos son de verdad y SOLO de él: ninguna venta a otro cliente.
  await expect(tabla).not.toContainText("Consumidor final");

  // La memoria: la frase siguiente viaja con lo último que se habló y de quién.
  await decir(page, "y su línea de tiempo");
  const contexto = pedidos[1].contexto!;
  expect(contexto.foco).toEqual({ cliente: { id: c.id, nombre: c.nombre } });
  expect(contexto.historial[0]).toEqual({ dijo: "ventas de andrés cabrera", respuesta: `Análisis "Ventas de ${c.nombre}" (Cliente: ${c.nombre})` });
});

test("con dos clientes que coinciden, pregunta cuál ANTES de mostrar nada; al elegir, todo es de ese", async ({ page, request }) => {
  const opciones = (await clientes(request, "andres")).slice(0, 2);
  expect(opciones.length).toBe(2);
  const elegido = opciones[1];
  const pendiente: VistaSpec = {
    titulo: "Ventas de Andrés",
    piezas: [
      { id: "p1", tipo: "tabla", fuente: "pedidos", params: { periodo: "este_anio", limite: 30 }, titulo: "Sus ventas" },
      { id: "p2", tipo: "conclusion" },
    ],
  };
  await simularFrases(page, {
    "ventas de andrés": propuesta({
      intencion: "analizar",
      capa: "C2",
      ejecutable: false,
      aviso: 'Hay más de un cliente que coincide con "Andrés": ¿de cuál querés verlo?',
      clientes: opciones,
      entidades: { pregunta: "ventas de andrés", filtroPendiente: "cliente", vistaPendiente: pendiente },
    }),
  });
  await simularConclusion(page, "Listo.");
  await page.goto("/omnibox");
  await decir(page, "ventas de andrés");

  const tarjeta = ultimaRespuesta(page);
  await expect(tarjeta).toHaveAttribute("data-estado", "elegir-cliente");
  // Nada de datos todavía: el panel no se abrió.
  await expect(panel(page)).toHaveCount(0);

  await tarjeta.getByTestId("omnibox-opcion-cliente").filter({ hasText: new RegExp(elegido.nombre, "i") }).click();
  // El servidor le puso el filtro a todas las piezas (vista/filtrar, de verdad).
  await expect(panel(page)).toHaveAttribute("data-mesa", "analisis");
  await expect(panel(page).getByTestId("vista-alcance")).toContainText(`Cliente: ${elegido.nombre}`);
  await expect(panel(page).locator('[data-testid="vista-pieza"][data-fuente="pedidos"]')).toContainText(`Cliente: ${elegido.nombre}`);
});

test("¿esas son solo de él?: se contesta con los filtros de la vista", async ({ page }) => {
  const filtros = { cliente: { id: "11111111-1111-4111-8111-111111111111", nombre: "José Luis Mamani" } };
  await simularFrases(page, {
    "esas son solo de josé?": propuesta({
      intencion: "explicar_vista",
      capa: "C1",
      resultado: { resumen: "Sí: todo lo que ves es solo del cliente José Luis Mamani, últimos 30 días.", datos: { filtros } },
    }),
  });
  await page.goto("/omnibox");
  await decir(page, "esas son solo de josé?");
  const explicacion = page.getByTestId("vista-explicacion");
  await expect(explicacion).toContainText("Sí: todo lo que ves es solo del cliente José Luis Mamani");
  await expect(explicacion.getByTestId("vista-alcance")).toContainText("Cliente: José Luis Mamani");
});

test("el cliente nuevo se completa conversando: «su teléfono…» llena ESE formulario, sin ir al servidor", async ({ page, request }) => {
  await simularFrases(page, {
    "es para zacarías prueba": propuesta({
      intencion: "elegir_cliente",
      entidades: { nombre: "zacarías prueba" },
      clientes: [],
      ejecutable: false,
      aviso: 'No tenés a "zacarías prueba" como cliente.',
    }),
  });
  await page.goto("/omnibox");
  try {
    await decir(page, "es para zacarías prueba");
    const form = page.getByTestId("formulario-cliente");
    await expect(form.getByLabel("Nombre del cliente")).toHaveValue("Zacarías Prueba");
    await expect(form.getByTestId("formulario-falta")).toContainText("Falta teléfono");

    // Si fuera al servidor, la frase no está simulada y daría error.
    await decir(page, "su teléfono es 000 001 77");
    await expect(ultimaRespuesta(page)).toContainText("Anoté teléfono: 00000177");
    await expect(form.getByLabel("Teléfono del cliente")).toHaveValue("00000177");
    await expect(form.getByTestId("formulario-falta")).toHaveCount(0);

    await decir(page, "crealo");
    await expect(page.getByText("La venta es para Zacarías Prueba")).toBeVisible();
  } finally {
    const headers = { Authorization: `Bearer ${await token(request)}` };
    for (const c of await clientes(request, "zacarias prueba")) {
      if (c.telefono === "00000177") await request.delete(`${API_URL}/api/customer/${c.id}`, { headers });
    }
  }
});
