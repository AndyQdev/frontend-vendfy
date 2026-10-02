import fs from "node:fs";

import type { APIRequestContext, Page } from "@playwright/test";

import type { HerramientaGenerada } from "../../src/entities/omnibox/model/types";
import { API_URL, COMERCIO_EMAIL, COMERCIO_PASSWORD, TIENDA } from "./env";
import { propuesta } from "./mock";

/**
 * Herramientas a medida (G6) para las pruebas, sin gastar el modelo.
 *
 * BEBIDAS es una herramienta de verdad: la escribió el modelo (Gemini 3.1 Pro)
 * para "qué pasa si subo 10 % las bebidas" con los datos de la tienda de
 * prueba, y se guardó tal cual. Corre en el iframe como cualquier otra.
 */
export const BEBIDAS: HerramientaGenerada = JSON.parse(fs.readFileSync("e2e/fixtures/herramienta-bebidas.json", "utf8"));

export const PREGUNTA_BEBIDAS = "qué pasa si subo 10 % las bebidas";

/** Lo que contesta el asistente a un "¿qué pasa si…?": la herramienta se pide aparte. */
export const simular = (pregunta = PREGUNTA_BEBIDAS) =>
  propuesta({ intencion: "simular", titulo: "Herramienta a medida", capa: "C2", entidades: { pregunta } });

/** Una herramienta que se rompe al dibujarse (lee una tabla que no existe), ya compilada. */
export const ROTA = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = function Herramienta(props) { return props.datos.no_existe.filas.length; };`;

/** Una herramienta que propone el precio de un producto que no estaba en sus datos. */
export const TRAMPOSA = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const React = require("react");
exports.default = function Herramienta(props) {
  return React.createElement("button", {
    onClick: function () { props.proponer({ tipo: "precios", cambios: [{ productId: "00000000-0000-4000-8000-00000000dead", precio: 1 }], motivo: "x" }); },
  }, "Aplicar");
};`;

type Respuesta = HerramientaGenerada | { status: number; message: string };

/**
 * POST /omnibox/herramienta simulado: cada pedido recibe la siguiente
 * respuesta (una herramienta o un error). `demora`: para ver la tarjeta
 * "Armando…" (la de verdad tarda ~45 s). Devuelve lo que pidió la pantalla.
 */
export async function simularHerramienta(page: Page, respuestas: Respuesta[], demora = 0) {
  const pedidos: { storeId: string; pregunta: string }[] = [];
  await page.route("**/api/omnibox/herramienta", async (route) => {
    pedidos.push(route.request().postDataJSON());
    const r = respuestas[Math.min(pedidos.length, respuestas.length) - 1];
    if (demora) await new Promise((ok) => setTimeout(ok, demora));
    if ("status" in r && "message" in r) {
      return route.fulfill({ status: r.status, json: { statusCode: r.status, message: r.message } });
    }
    return route.fulfill({ status: 201, json: { statusCode: 200, data: r } });
  });
  return pedidos;
}

/** POST /omnibox/herramienta/corregir simulado. Devuelve lo que se mandó a corregir. */
export async function simularCorreccion(page: Page, respuesta: { tsx: string; codigo: string }) {
  const pedidos: { pregunta: string; plan: unknown; tsx: string; error: string; datos: unknown }[] = [];
  await page.route("**/api/omnibox/herramienta/corregir", async (route) => {
    pedidos.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, json: { statusCode: 200, data: respuesta } });
  });
  return pedidos;
}

async function token(request: APIRequestContext) {
  const login = await request.post(`${API_URL}/api/auth/login`, { data: { email: COMERCIO_EMAIL, password: COMERCIO_PASSWORD } });
  return (await login.json()).data.accessToken as string;
}

/** Los precios de lista de ahora, por producto (de la base, no de la herramienta). */
export async function preciosReales(request: APIRequestContext, ids: string[]): Promise<Map<string, number>> {
  const r = await request.post(`${API_URL}/api/omnibox/vista/fuente`, {
    headers: { Authorization: `Bearer ${await token(request)}` },
    data: { storeId: TIENDA.id, fuente: "precios_por_producto", params: { limite: 100 } },
  });
  const filas = ((await r.json()).data.filas ?? []) as { _productId: string; precio: number }[];
  return new Map(filas.filter((f) => ids.includes(f._productId)).map((f) => [f._productId, f.precio]));
}

/** Deja los precios como estaban: las pruebas que confirman cambios no dejan rastro en la tienda. */
export async function restaurarPrecios(request: APIRequestContext, precios: Map<string, number>) {
  if (precios.size === 0) return;
  const r = await request.post(`${API_URL}/api/omnibox/precios`, {
    headers: { Authorization: `Bearer ${await token(request)}` },
    data: { storeId: TIENDA.id, cambios: [...precios].map(([productId, precio]) => ({ productId, precio })) },
  });
  if (!r.ok()) throw new Error(`No se pudieron restaurar los precios: ${r.status()} ${await r.text()}`);
}
