import { expect, test, type APIRequestContext } from "@playwright/test";

import type { ListaRecurso, Propuesta } from "../../src/entities/omnibox/model/types";
import { decir } from "../helpers/chat";
import { API_URL, COMERCIO_EMAIL, COMERCIO_PASSWORD, TIENDA } from "../helpers/env";
import { propuesta, simularFrases } from "../helpers/mock";

/**
 * Fase G9a · las listas y fichas del sistema, en el chat.
 *
 * Lo que entiende el modelo está simulado (el agente "pidió" una lista); la
 * lista, sus filtros, el orden y la ficha salen del backend de verdad.
 */

async function listaReal(request: APIRequestContext, recurso: string, filtros: Record<string, unknown>): Promise<ListaRecurso> {
  const login = await request.post(`${API_URL}/api/auth/login`, { data: { email: COMERCIO_EMAIL, password: COMERCIO_PASSWORD } });
  const token = (await login.json()).data.accessToken as string;
  const q = new URLSearchParams({ storeId: TIENDA.id, filtros: JSON.stringify(filtros) });
  const r = await request.get(`${API_URL}/api/omnibox/recurso/${recurso}?${q}`, { headers: { Authorization: `Bearer ${token}` } });
  expect(r.ok()).toBeTruthy();
  return (await r.json()).data as ListaRecurso;
}

function delAgente(texto: string, acciones: Propuesta[]): Propuesta {
  return propuesta({ intencion: "agente", titulo: null, capa: "C4", agente: { texto, acciones, motivo: "sin_ejecutor" } });
}

test("«listame los productos de más de 1 Bs»: la lista a la derecha, el chip se saca sin modelo y la fila abre su ficha", async ({ page, request }) => {
  const lista = await listaReal(request, "productos", { precio_min: 1 });
  expect(lista.filas.length).toBeGreaterThan(0);
  const pedidos = await simularFrases(page, {
    "listame los productos de más de 1 boliviano": delAgente(lista.texto, [propuesta({ intencion: "lista", titulo: lista.titulo, capa: "C3", entidades: { lista } })]),
    "y ahora solo los que no se ven en la web": delAgente("Listo.", []),
  });
  await page.goto("/omnibox");
  await decir(page, "listame los productos de más de 1 boliviano");

  // En el chat, el resumen; a la derecha, la lista entera con su filtro como chip.
  await expect(page.getByTestId("tarjeta-lista")).toContainText(String(lista.resumen.total));
  const panel = page.getByTestId("omnibox-mesa");
  await expect(panel).toHaveAttribute("data-mesa", "lista");
  await expect(panel.getByTestId("lista-chip")).toHaveText(/Precio desde Bs 1/);
  await expect(panel.getByTestId("lista-fila").first()).toBeVisible();

  // La frase siguiente viaja con la lista a la vista (para "solo los que…").
  await decir(page, "y ahora solo los que no se ven en la web");
  expect(pedidos[1].contexto).toMatchObject({ enPantalla: "lista", lista: { recurso: "productos", filtros: { precio_min: 1 } } });

  // Sacar el chip vuelve a consultar al backend, no al modelo.
  const consulta = page.waitForRequest((r) => r.url().includes("/api/omnibox/recurso/productos") && r.url().includes(encodeURIComponent("{}")));
  await panel.getByTestId("lista-chip").click();
  await consulta;
  await expect(panel.getByTestId("lista-chip")).toHaveCount(0);

  // Una fila abre su ficha, y se vuelve a la lista.
  const primera = String(lista.filas[0].producto);
  await panel.getByTestId("lista-fila").filter({ hasText: primera }).first().click();
  await expect(panel).toHaveAttribute("data-mesa", "ficha");
  await expect(panel.getByTestId("ficha-titulo")).toHaveText(primera);
  await panel.getByRole("button", { name: "Volver a la lista" }).click();
  await expect(panel).toHaveAttribute("data-mesa", "lista");
  await expect(page).toHaveURL(/\/omnibox/);
});

test("una ficha pedida por el agente: se abre a la derecha y su tarjeta dice qué es", async ({ page, request }) => {
  const lista = await listaReal(request, "productos", {});
  const id = String(lista.filas[0]._id);
  const login = await request.post(`${API_URL}/api/auth/login`, { data: { email: COMERCIO_EMAIL, password: COMERCIO_PASSWORD } });
  const token = (await login.json()).data.accessToken as string;
  const ficha = (await (await request.get(`${API_URL}/api/omnibox/recurso/productos/${id}?storeId=${TIENDA.id}`, { headers: { Authorization: `Bearer ${token}` } })).json()).data;
  await simularFrases(page, {
    "abrí el primer producto": delAgente(`Te abrí ${ficha.titulo} a la derecha.`, [propuesta({ intencion: "ficha", titulo: ficha.titulo, capa: "C3", entidades: { ficha } })]),
  });
  await page.goto("/omnibox");
  await decir(page, "abrí el primer producto");
  await expect(page.getByTestId("tarjeta-ficha")).toContainText(ficha.titulo);
  const panel = page.getByTestId("omnibox-mesa");
  await expect(panel).toHaveAttribute("data-mesa", "ficha");
  await expect(panel.getByTestId("ficha-titulo")).toHaveText(ficha.titulo);
  await expect(panel).toContainText("Precio");
});
