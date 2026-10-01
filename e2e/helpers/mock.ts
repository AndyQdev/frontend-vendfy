import type { APIRequestContext, Page, Request } from "@playwright/test";

import type { ProductoOpcion, Propuesta, TablaVista, VentaCobrada, VistaSpec } from "../../src/entities/omnibox/model/types";
import { API_URL, COMERCIO_EMAIL, COMERCIO_PASSWORD, TIENDA } from "./env";

/**
 * Respuestas simuladas del asistente, para probar la PANTALLA sin depender
 * del modelo: no gastan créditos de IA, no cambian de una corrida a otra y no
 * escriben ventas reales. Lo que se simula es solo la interpretación de la
 * frase y, si hace falta, el cobro; el login, el catálogo y la búsqueda son
 * los de verdad.
 *
 * La interpretación de verdad se prueba en el backend (gramatica.spec,
 * venta-hablada.spec) y en los flujos de e2e/flows que hablan con el modelo.
 */

export function propuesta(p: Partial<Propuesta> & { intencion: string }): Propuesta {
  return {
    titulo: p.intencion,
    confianza: 1,
    capa: "C1",
    entidades: {},
    faltan: [],
    opciones: [],
    noEncontrado: null,
    requiereConfirmacion: false,
    vistaPrevia: null,
    ejecutable: true,
    resultado: null,
    aviso: null,
    producto: null,
    bloqueo: null,
    ms: 5,
    ...p,
  };
}

/**
 * Cada frase escrita en el chat responde con su propuesta. Devuelve lo que
 * mandó la pantalla (la frase y su contexto), para revisarlo.
 */
export async function simularFrases(page: Page, frases: Record<string, Propuesta>) {
  const pedidos: { texto: string; contexto?: Record<string, any> }[] = [];
  await page.route("**/api/omnibox/interpretar", async (route) => {
    const cuerpo = route.request().postDataJSON() ?? {};
    pedidos.push(cuerpo);
    const texto = (cuerpo.texto ?? "") as string;
    const p = frases[texto];
    if (!p) return route.fulfill({ status: 500, json: { message: `Frase sin simular: ${texto}` } });
    return route.fulfill({ json: { statusCode: 200, data: p } });
  });
  return pedidos;
}

/**
 * El cobro simulado. `respuesta`: la venta cobrada, o un error del servidor
 * ({ status, message }). Devuelve los pedidos que llegaron, para revisar qué
 * mandó la pantalla (el método de pago, las líneas).
 */
export async function simularCobro(
  page: Page,
  respuesta: Partial<VentaCobrada> | { status: number; message: string },
): Promise<Request[]> {
  const llegados: Request[] = [];
  await page.route("**/api/omnibox/cobrar", async (route) => {
    llegados.push(route.request());
    if ("status" in respuesta && "message" in respuesta) {
      return route.fulfill({ status: respuesta.status, json: { statusCode: respuesta.status, message: respuesta.message } });
    }
    const body = route.request().postDataJSON();
    const venta: VentaCobrada = {
      orderId: "00000000-0000-4000-8000-000000000001",
      numero: 9001,
      total: 18,
      pago: body.pago,
      cliente: "Consumidor final",
      estado: "completado",
      unidades: 1,
      ...(respuesta as Partial<VentaCobrada>),
    };
    return route.fulfill({ status: 201, json: { statusCode: 201, data: venta } });
  });
  return llegados;
}

/** Un producto real de la tienda de prueba, como lo devuelve el buscador. */
export async function productoReal(request: APIRequestContext, busqueda: string): Promise<ProductoOpcion> {
  const login = await request.post(`${API_URL}/api/auth/login`, {
    data: { email: COMERCIO_EMAIL, password: COMERCIO_PASSWORD },
  });
  const token = (await login.json()).data.accessToken as string;
  const r = await request.get(`${API_URL}/api/omnibox/productos?storeId=${TIENDA.id}&q=${encodeURIComponent(busqueda)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (await r.json()).data[0];
}

/** "vendé N <producto>" ya interpretado: agregar a la venta. */
export function agregarAVenta(producto: ProductoOpcion, cantidad = 1, opciones: { cantidadDicha?: boolean } = {}): Propuesta {
  return propuesta({
    intencion: "agregar_a_venta",
    producto,
    entidades: { cantidad, producto: producto.nombre, productId: producto.productId, ...opciones },
  });
}

/**
 * Las sugerencias del servidor, simuladas por mesa. Devuelve los eventos que
 * mandó la pantalla (mostrada / aceptada / descartada) para revisarlos.
 */
export async function simularSugerencias(
  page: Page,
  porMesa: { venta?: unknown[]; compra?: unknown[] } = {},
): Promise<{ codigo: string; evento: string }[]> {
  const eventos: { codigo: string; evento: string }[] = [];
  await page.route("**/api/omnibox/sugerencias/evento", async (route) => {
    const b = route.request().postDataJSON();
    eventos.push({ codigo: b.codigo, evento: b.evento });
    return route.fulfill({ json: { statusCode: 200, data: null } });
  });
  await page.route("**/api/omnibox/sugerencias", async (route) => {
    const mesa = route.request().postDataJSON()?.mesa as "venta" | "compra";
    return route.fulfill({ json: { statusCode: 200, data: porMesa[mesa] ?? [] } });
  });
  return eventos;
}

/** Lo que devuelve una fuente de las vistas (G3) con los datos reales de la tienda. */
export async function fuenteReal(
  request: APIRequestContext,
  fuente: string,
  params: Record<string, unknown>,
): Promise<TablaVista> {
  const login = await request.post(`${API_URL}/api/auth/login`, {
    data: { email: COMERCIO_EMAIL, password: COMERCIO_PASSWORD },
  });
  const token = (await login.json()).data.accessToken as string;
  const r = await request.post(`${API_URL}/api/omnibox/vista/fuente`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { storeId: TIENDA.id, fuente, params },
  });
  return (await r.json()).data;
}

/** Una pregunta de análisis ya planificada: la vista que habría armado la IA. */
export function analizar(vista: VistaSpec, aviso: string | null = null): Propuesta {
  return propuesta({ intencion: "analizar", titulo: vista.titulo, capa: "C2", vista, aviso });
}

/**
 * La conclusión simulada (la escribe la IA: no se gastan créditos en cada
 * corrida). Devuelve lo que pidió la pantalla, para revisar la vista que mandó.
 */
export async function simularConclusion(page: Page, texto: string): Promise<{ pregunta: string; vista: VistaSpec }[]> {
  const pedidos: { pregunta: string; vista: VistaSpec }[] = [];
  await page.route("**/api/omnibox/vista/conclusion", async (route) => {
    pedidos.push(route.request().postDataJSON());
    return route.fulfill({ json: { statusCode: 200, data: { conclusion: texto } } });
  });
  return pedidos;
}

/** Saca del tablero de la tienda de prueba las vistas que fijó una prueba (por el prefijo del nombre). */
export async function limpiarFijadas(request: APIRequestContext, prefijo: string) {
  const login = await request.post(`${API_URL}/api/auth/login`, {
    data: { email: COMERCIO_EMAIL, password: COMERCIO_PASSWORD },
  });
  const headers = { Authorization: `Bearer ${(await login.json()).data.accessToken}` };
  const r = await request.get(`${API_URL}/api/omnibox/vistas-fijadas?storeId=${TIENDA.id}`, { headers });
  for (const f of ((await r.json()).data ?? []) as { id: string; nombre: string }[]) {
    if (f.nombre.startsWith(prefijo)) {
      await request.delete(`${API_URL}/api/omnibox/vistas-fijadas/${f.id}?storeId=${TIENDA.id}`, { headers });
    }
  }
}
