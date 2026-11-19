import { expect, type Page } from "@playwright/test";

import { API_URL, TIENDA } from "./env";

/**
 * El piloto ("Vendfy") en las pruebas: se abre la bola, se toca el teclado y
 * se le escribe (lo mismo que hablarle, sin micrófono); se espera lo que
 * contesta en los subtítulos.
 */
export async function pedirAlPiloto(page: Page, texto: string, espera: string | RegExp, timeout = 60_000) {
  const campo = page.getByTestId("piloto-campo");
  if (!(await campo.isVisible().catch(() => false))) {
    if (!(await page.getByTestId("piloto-tarjeta").isVisible().catch(() => false))) {
      await page.getByTestId("piloto-lanzador").click();
      await expect(page.getByTestId("piloto-tarjeta")).toBeVisible();
    }
    await page.getByTestId("piloto-teclado").click();
    await expect(campo).toBeVisible();
  }
  await campo.fill(texto);
  await campo.press("Enter");
  await expect(page.getByTestId("piloto-linea")).toContainText(espera, { timeout });
}

export async function cerrarPiloto(page: Page) {
  if (await page.getByTestId("piloto-tarjeta").isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Cerrar Vendfy" }).click();
    // Que termine de irse: mientras se va, el campo sigue a la vista y lo que se escribe se pierde.
    await expect(page.getByTestId("piloto-tarjeta")).toBeHidden();
  }
}

/** La API con la sesión de la página (para preparar y dejar todo como estaba). */
export async function api<T = any>(page: Page, ruta: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  return page.evaluate(
    async ({ base, ruta, init }) => {
      const r = await fetch(`${base}/api${ruta}`, {
        method: init.method ?? "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("authToken")}` },
        body: init.body ? JSON.stringify(init.body) : undefined,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`${ruta} → ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
      return j.data ?? j;
    },
    { base: API_URL, ruta, init },
  );
}

export async function stockDe(page: Page, nombre: string): Promise<{ productId: string; storeProductId: string; stock: number }> {
  const d = await api(page, `/inventory?storeId=${TIENDA.id}&search=${encodeURIComponent(nombre)}&limit=5`);
  const fila = (d.data ?? d).find((x: any) => x.product.name === nombre);
  return { productId: fila.product.id, storeProductId: fila.storeProductId, stock: Number(fila.stockQuantity) };
}

export function fijarStock(page: Page, productId: string, producto: string, cantidad: number) {
  return api(page, "/omnibox/confirmar", {
    method: "POST",
    body: { intencion: "ajustar_stock", entidades: { productId, producto, cantidad, motivo: "Prueba del piloto: vuelve como estaba" }, storeId: TIENDA.id },
  });
}

export function carrito(page: Page): Promise<{ name: string; quantity: number }[]> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("vendfy.venta-en-curso.v1") ?? "{}").items ?? []);
}
