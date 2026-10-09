import { expect, test, type APIRequestContext } from "@playwright/test";

import type { BorradorProducto, Propuesta } from "../../src/entities/omnibox/model/types";
import { decir, ultimaRespuesta } from "../helpers/chat";
import { API_URL, COMERCIO_EMAIL, COMERCIO_PASSWORD, TIENDA } from "../helpers/env";
import { productoReal, propuesta, simularFrases } from "../helpers/mock";

/**
 * Fase G7 · el agente y los productos en el chat.
 *
 * Lo que entiende el modelo está simulado (la respuesta del agente: su texto
 * y las tarjetas que preparó). Lo demás es de verdad: crear los productos,
 * cargarlos a la compra, cambiar un precio. Lo que se crea se da de baja y lo
 * que se cambia se vuelve a dejar como estaba.
 */

const SUFIJO = `E2E${Date.now().toString().slice(-6)}`;

async function token(request: APIRequestContext) {
  const r = await request.post(`${API_URL}/api/auth/login`, { data: { email: COMERCIO_EMAIL, password: COMERCIO_PASSWORD } });
  return (await r.json()).data.accessToken as string;
}

/** Da de baja (borrado suave, como Productos) lo que creó la prueba. */
async function bajaDeLoCreado(request: APIRequestContext, nombres: string[]) {
  const headers = { Authorization: `Bearer ${await token(request)}` };
  for (const n of nombres) {
    const r = await request.get(`${API_URL}/api/omnibox/productos?storeId=${TIENDA.id}&q=${encodeURIComponent(n)}`, { headers });
    for (const p of ((await r.json()).data ?? []) as { productId: string; nombre: string }[]) {
      if (p.nombre.includes(SUFIJO)) await request.delete(`${API_URL}/api/product/${p.productId}`, { headers });
    }
  }
}

const borrador = (nombre: string, extra: Partial<BorradorProducto> = {}): BorradorProducto => ({
  nombre,
  precio: null,
  stock: null,
  categoria: null,
  codigo: null,
  marca: null,
  compra: null,
  existente: null,
  ...extra,
});

function delAgente(texto: string, acciones: Propuesta[]): Propuesta {
  return propuesta({ intencion: "agente", titulo: null, capa: "C4", agente: { texto, acciones, motivo: "sin_ejecutor" } });
}

test("«no tengo alcohol, crealo»: el texto del agente, el formulario a la derecha, «a 12» y «crealo» sin salir", async ({ page, request }) => {
  const nombre = `Alcohol en Gel ${SUFIJO}`;
  await simularFrases(page, {
    "no tengo alcohol en gel, crealo": delAgente("No tenés alcohol en gel en tu catálogo. Falta el precio de venta.", [
      propuesta({ intencion: "crear_producto", titulo: "Productos nuevos", capa: "C3", entidades: { productos: [borrador(nombre)] } }),
    ]),
  });
  await page.goto("/omnibox");
  try {
    await decir(page, "no tengo alcohol en gel, crealo");
    await expect(page.getByTestId("agente-texto")).toContainText("No tenés alcohol en gel en tu catálogo");
    // G9b: en pantalla ancha el formulario se arma a la derecha; en el chat queda el resumen.
    const form = page.getByTestId("omnibox-mesa").getByTestId("formulario-productos");
    await expect(page.getByTestId("omnibox-mesa")).toHaveAttribute("data-mesa", "productos");
    await expect(page.getByTestId("resumen-productos")).toContainText(nombre);
    await expect(form.getByLabel("Nombre del producto 1")).toHaveValue(nombre);
    await expect(form.getByTestId("formulario-falta")).toContainText("Falta el precio");

    // "a 12": un solo producto sin precio → se anota sin ir al servidor (si fuera, la frase no está simulada).
    await decir(page, "a 12");
    await expect(form.getByLabel(`Precio de ${nombre}`)).toHaveValue("12");
    await expect(form.getByTestId("formulario-falta")).toHaveCount(0);

    await decir(page, "crealo");
    // Creado: el panel lo suelta y en el chat queda lo que se creó.
    await expect(page.getByTestId("formulario-productos")).toHaveAttribute("data-estado", "creado");
    await expect(page.getByTestId("omnibox-mesa")).toHaveCount(0);
    await expect(page.getByTestId("producto-creado")).toContainText(nombre);
    // Nada navegó: seguimos en el asistente.
    await expect(page).toHaveURL(/\/omnibox/);
  } finally {
    await bajaDeLoCreado(request, [nombre]);
  }
});

test("«compré dos cosas nuevas»: se completan en la tarjeta, se crean y quedan cargadas en la compra", async ({ page, request }) => {
  const mouse = `Mouse ${SUFIJO}`;
  const guantes = `Guantes ${SUFIJO}`;
  const pedidos = await simularFrases(page, {
    "compré mouses y guantes, ayudame a crearlos": delAgente("No existían: completá el precio de venta y lo que compraste.", [
      propuesta({
        intencion: "crear_producto",
        titulo: "Productos nuevos",
        capa: "C3",
        entidades: {
          productos: [borrador(mouse, { compra: { cantidad: 5, costo: 40 } }), borrador(guantes, { compra: { cantidad: null, costo: null } })],
        },
      }),
    ]),
  });
  await page.goto("/omnibox");
  try {
    await decir(page, "compré mouses y guantes, ayudame a crearlos");
    const form = page.getByTestId("formulario-productos");
    await expect(form.getByTestId("producto-nuevo")).toHaveCount(2);
    // Con la tarjeta abierta, la frase siguiente viaja con el formulario (para el agente).
    await form.getByLabel(`Precio de ${mouse}`).fill("60");
    await form.getByLabel(`Precio de ${guantes}`).fill("15");
    await form.getByLabel(`Cuántos ${guantes} compraste`).fill("10");
    await form.getByLabel(`Costo de ${guantes}`).fill("9");
    await form.getByTestId("formulario-crear").click();

    await expect(form).toHaveAttribute("data-estado", "creado");
    await expect(page.getByTestId("producto-creado")).toHaveCount(2);
    await expect(page.getByText(/Cargué en la compra/)).toBeVisible();
    // La compra (el borrador del panel, no registrada) tiene los dos.
    const panel = page.getByTestId("omnibox-mesa");
    await expect(panel).toHaveAttribute("data-mesa", "compra");
    await expect(panel).toContainText(mouse);
    await expect(panel).toContainText(guantes);
    expect(pedidos).toHaveLength(1);
  } finally {
    await bajaDeLoCreado(request, [mouse, guantes]);
  }
});

test("una frase con el formulario abierto viaja con él, para que el agente lo complete", async ({ page }) => {
  const a = `Vacuna ${SUFIJO}`;
  const b = `Jeringa ${SUFIJO}`;
  const pedidos = await simularFrases(page, {
    "creá vacunas y jeringas": delAgente("Te dejé los 2 productos listos para crear.", [
      propuesta({ intencion: "crear_producto", titulo: "Productos nuevos", capa: "C3", entidades: { productos: [borrador(a), borrador(b)] } }),
    ]),
    "las vacunas a 80 y las jeringas a 3": delAgente("Lo anoté en el formulario.", [
      propuesta({
        intencion: "completar_formulario",
        titulo: "Productos nuevos",
        capa: "C3",
        entidades: { productos: [borrador(a, { precio: 80 }), borrador(b, { precio: 3 })] },
      }),
    ]),
  });
  await page.goto("/omnibox");
  await decir(page, "creá vacunas y jeringas");
  await decir(page, "las vacunas a 80 y las jeringas a 3");
  expect(pedidos[1].contexto?.formulario).toEqual({
    tipo: "productos",
    productos: [expect.objectContaining({ nombre: a, precio: null }), expect.objectContaining({ nombre: b, precio: null })],
  });
  // El MISMO formulario se completó (no apareció otro).
  const forms = page.getByTestId("formulario-productos");
  await expect(forms).toHaveCount(1);
  await expect(forms.getByLabel(`Precio de ${a}`)).toHaveValue("80");
  await expect(forms.getByLabel(`Precio de ${b}`)).toHaveValue("3");
  await expect(forms.getByTestId("formulario-falta")).toHaveCount(0);
});

test("«No está en tu catálogo» → «Crear ahora» abre el formulario a la derecha, no la pantalla de Productos", async ({ page }) => {
  await simularFrases(page, {
    "cuánto queda de desinfectante": propuesta({
      intencion: "consultar_stock",
      ejecutable: false,
      noEncontrado: "desinfectante",
      aviso: 'No encontré "desinfectante" en tu catálogo.',
    }),
  });
  await page.goto("/omnibox");
  await decir(page, "cuánto queda de desinfectante");
  await ultimaRespuesta(page).getByTestId("sin-producto-crear").click();
  await expect(page).toHaveURL(/\/omnibox/);
  await expect(page.getByTestId("formulario-productos").getByLabel("Nombre del producto 1")).toHaveValue("Desinfectante");
});

test("cambiar un producto: antes → después, se confirma y queda (y se deja como estaba)", async ({ page, request }) => {
  const p = await productoReal(request, "coca");
  const nuevo = Math.round((p.precio + 1) * 100) / 100;
  const dinero = (n: number) => n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  await simularFrases(page, {
    "subile un boliviano a la coca": delAgente("Revisalo y confirmalo acá abajo.", [
      propuesta({
        intencion: "editar_producto",
        titulo: `Cambiar ${p.nombre}`,
        capa: "C3",
        requiereConfirmacion: true,
        producto: p,
        entidades: {
          productId: p.productId,
          cambios: { precio: nuevo },
          filas: [{ campo: "precio", etiqueta: "Precio", antes: `Bs ${dinero(p.precio)}`, despues: `Bs ${dinero(nuevo)}` }],
        },
      }),
    ]),
  });
  await page.goto("/omnibox");
  try {
    await decir(page, "subile un boliviano a la coca");
    await expect(page.getByTestId("cambio-filas")).toContainText(`Bs ${dinero(nuevo)}`);
    await page.getByTestId("cambio-confirmar").click();
    await expect(page.getByText(/^Listo/).last()).toBeVisible();
    expect((await productoReal(request, "coca")).precio).toBe(nuevo);
  } finally {
    const headers = { Authorization: `Bearer ${await token(request)}` };
    await request.post(`${API_URL}/api/omnibox/producto/${p.productId}/cambiar`, {
      headers,
      data: { storeId: TIENDA.id, cambios: { precio: p.precio } },
    });
  }
});

test("«qué pedidos tengo»: la lista, y «Mover» arma la tarjeta para confirmar (no lo mueve solo)", async ({ page }) => {
  const pedidos = [
    { orderId: "00000000-0000-4000-8000-0000000000a1", numero: 7001, estado: "pendiente", cliente: "Marta Prueba", total: 50, productos: "1 × Chaqueta", fecha: "08/10/2026 10:00", tipo: "delivery", origen: "web" },
  ];
  await simularFrases(page, {
    "qué pedidos tengo pendientes": delAgente("Tenés un pedido pendiente de Marta Prueba.", [
      propuesta({ intencion: "ver_pedidos", titulo: "Pedidos", capa: "C3", entidades: { pedidos } }),
    ]),
  });
  let movido = false;
  await page.route("**/api/omnibox/pedido/*/estado", (route) => {
    movido = true;
    return route.fulfill({ status: 500, json: { message: "no debería llegar" } });
  });
  await page.goto("/omnibox");
  await decir(page, "qué pedidos tengo pendientes");
  await expect(page.getByTestId("pedido-fila")).toContainText("Marta Prueba");
  await page.getByTestId("pedido-fila").getByRole("button", { name: "Mover" }).click();
  await page.getByTestId("pedido-mover-en-camino").click();
  const tarjeta = ultimaRespuesta(page);
  await expect(tarjeta).toHaveAttribute("data-estado", "estado-pedido");
  await expect(tarjeta).toContainText("Pedido #7001");
  await expect(tarjeta.getByTestId("estado-pedido-confirmar")).toContainText("Pasar a en camino");
  expect(movido).toBe(false);
});

test("un código de barras que la tienda no tiene: el formulario para crearlo, sin IA", async ({ page }) => {
  // 779 (Argentina) + dígito verificador correcto, que nadie tiene cargado.
  const base = "779000731000";
  const suma = [...base].reduce((s, d, i) => s + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  const codigo = base + ((10 - (suma % 10)) % 10);
  // Sin simular /interpretar: si fuera al modelo, igual respondería; lo que se revisa es que vaya por código.
  await page.goto("/omnibox");
  await decir(page, codigo);
  const form = page.getByTestId("formulario-productos");
  await expect(form).toBeVisible();
  await expect(form).toContainText(`Código de barras: ${codigo}`);
  await expect(page.getByText(new RegExp(`El código ${codigo}|Según el catálogo`))).toBeVisible();
});
