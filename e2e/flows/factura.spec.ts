import path from "node:path";

import { expect, test, type APIRequestContext } from "@playwright/test";

import { API_URL, COMERCIO_EMAIL, COMERCIO_PASSWORD, TIENDA } from "../helpers/env";

/**
 * Fase 5 · la compra desde una foto de la factura.
 *
 * La factura de prueba (`fixtures/factura.png`, armada desde `factura.html`)
 * tiene 5 renglones: cuatro productos de Don Juan y unas galletas que no
 * existen. Tiene que terminar en una compra registrada sin tipear un número:
 * solo el precio de venta del producto nuevo, que la factura no puede saber.
 *
 * Lee la foto con el modelo de verdad (o con un Gemini simulado apuntando
 * GEMINI_BASE_URL del backend a otro lado). Por eso resuelve los renglones
 * pendientes por lo que son y no por su posición: otro modelo puede
 * reconocer el aceite solo, o no.
 *
 * Deja el stock como estaba y da de baja el producto creado.
 */

const FACTURA = path.join(__dirname, "..", "fixtures", "factura.png");

const PRODUCTOS = [
  { q: "coca", suma: 6 },
  { q: "arroz", suma: 4 },
  { q: "leche", suma: 12 },
  { q: "aceite vegetal", suma: 5 },
];

async function sesion(request: APIRequestContext) {
  const r = await request.post(`${API_URL}/api/auth/login`, {
    data: { email: COMERCIO_EMAIL, password: COMERCIO_PASSWORD },
  });
  return { Authorization: `Bearer ${(await r.json()).data.accessToken}` };
}

async function buscar(request: APIRequestContext, h: Record<string, string>, q: string) {
  const r = await request.get(`${API_URL}/api/omnibox/productos?storeId=${TIENDA.id}&q=${encodeURIComponent(q)}`, { headers: h });
  return (await r.json()).data as { productId: string; nombre: string; stock: number }[];
}

async function stock(request: APIRequestContext, h: Record<string, string>, q: string) {
  const [p] = await buscar(request, h, q);
  const f = (await (await request.get(`${API_URL}/api/omnibox/producto/${p.productId}?storeId=${TIENDA.id}`, { headers: h })).json()).data;
  return { productId: p.productId, nombre: p.nombre, stock: f.stock as number };
}

test("sacarle una foto a la factura termina en una compra registrada", async ({ page, request }) => {
  test.setTimeout(120_000);
  const h = await sesion(request);
  const antes = await Promise.all(PRODUCTOS.map((p) => stock(request, h, p.q)));
  let galletas: string | null = null;

  try {
    await page.goto("/omnibox");

    // El clip sube la foto; en el hilo aparece la foto como lo que "dijo".
    await page.getByTestId("omnibox-archivo").setInputFiles(FACTURA);
    await expect(page.getByTestId("omnibox-foto-factura")).toBeVisible();

    const tarjeta = page.locator('[data-estado="factura"], [data-estado="factura-lista"]').last();
    // El lector a veces lo devuelve como está impreso ("DISTRIBUIDORA ANDINA S.R.L.").
    await expect(tarjeta).toContainText("Distribuidora Andina", { timeout: 60_000, ignoreCase: true });
    const renglones = tarjeta.getByTestId("omnibox-renglon-factura");
    await expect(renglones).toHaveCount(5);

    // Lo reconocido ya está a la derecha, con el proveedor y la foto.
    const mesa = page.getByTestId("omnibox-mesa");
    await expect(mesa).toHaveAttribute("data-mesa", "compra");
    await expect(mesa.getByPlaceholder("Distribuidora, marca…")).toHaveValue(/Distribuidora Andina/i);
    await expect(mesa.getByTestId("omnibox-adjunto-compra")).toBeVisible();

    // Con renglones pendientes, no se puede registrar.
    await expect(mesa.getByTestId("omnibox-compra-por-resolver")).toBeVisible();
    await expect(mesa.getByTestId("omnibox-registrar-compra")).toBeDisabled();

    // Las galletas no existen: se crean ahí mismo.
    const renglonGalletas = renglones.filter({ hasText: /galletas/i });
    await expect(renglonGalletas).not.toHaveAttribute("data-estado", "reconocido");
    if ((await renglonGalletas.getByTestId("omnibox-crear-producto-factura").count()) === 0) {
      await renglonGalletas.getByTestId("omnibox-crear-desde-factura").click();
    }
    await expect(renglonGalletas.getByLabel("Nombre del producto nuevo")).toHaveValue(/galletas maria/i);
    await renglonGalletas.getByLabel("Precio de venta del producto nuevo").fill("6");
    await renglonGalletas.getByTestId("omnibox-crear-producto-factura").click();
    await expect(renglonGalletas).toHaveAttribute("data-estado", "resuelto");

    // Lo dudoso (el aceite, si el modelo no lo reconoció): se elige.
    const renglonAceite = renglones.filter({ hasText: /aceite/i });
    if ((await renglonAceite.getAttribute("data-estado")) === "dudoso") {
      await renglonAceite.getByTestId("omnibox-opcion-factura").filter({ hasText: "Aceite vegetal" }).click();
    }

    await expect(mesa.getByTestId("omnibox-compra-por-resolver")).toHaveCount(0);
    await expect(page.getByTestId("omnibox-linea-compra")).toHaveCount(5);
    await expect(mesa.getByLabel("Costo de Coca Cola 2L")).toHaveValue("10.5");
    await expect(mesa.getByTestId("omnibox-total-compra")).toHaveText(/Bs 379,90/);

    // Registrar: se confirma, y la compra queda en el hilo con su factura.
    await mesa.getByTestId("omnibox-registrar-compra").click();
    await mesa.getByTestId("omnibox-confirmar-compra").click();
    const registrada = page.getByTestId("omnibox-compra").last();
    await expect(registrada).toContainText("Compra registrada");
    await expect(registrada).toContainText("Bs 379,90");
    await expect(registrada.getByText("Ver la factura")).toBeVisible();

    const despues = await Promise.all(PRODUCTOS.map((p) => stock(request, h, p.q)));
    PRODUCTOS.forEach((p, i) => expect(despues[i].stock, p.q).toBe(antes[i].stock + p.suma));
    const [g] = await buscar(request, h, "galletas maria");
    galletas = g?.productId ?? null;
    expect(g?.stock).toBe(10);
  } finally {
    for (const p of antes) {
      const r = await request.post(`${API_URL}/api/omnibox/confirmar`, {
        headers: h,
        data: {
          intencion: "ajustar_stock",
          entidades: { producto: p.nombre, productId: p.productId, cantidad: p.stock, motivo: "prueba e2e: vuelve como estaba" },
          storeId: TIENDA.id,
        },
      });
      expect(r.ok(), `no se pudo devolver el stock de ${p.nombre}: ${await r.text()}`).toBe(true);
    }
    if (!galletas) galletas = (await buscar(request, h, "galletas maria"))[0]?.productId ?? null;
    if (galletas) await request.delete(`${API_URL}/api/product/${galletas}`, { headers: h });
  }
});
