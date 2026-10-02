import { expect, test, type Page } from "@playwright/test";

import { decir } from "../helpers/chat";
import {
  agregarAVenta,
  limpiarConversaciones,
  productoReal,
  propuesta,
  simularCobro,
  simularFrases,
  simularSugerencias,
} from "../helpers/mock";

/**
 * Fase G5 · conversaciones guardadas: la conversación se guarda sola (los
 * mensajes y la mesa, juntos), recargar vuelve a la misma, y desde el panel
 * se abren, buscan, renombran y borran.
 *
 * La interpretación y el cobro están simulados; el guardado es el de verdad
 * (backend real), y cada prueba borra las conversaciones que creó.
 */

const mesa = (page: Page) => page.getByTestId("omnibox-mesa");
const dinero = (n: number) => n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const guardada = (page: Page) => expect(page.getByTestId("conversacion-guardado")).toHaveAttribute("data-estado", "guardado");

let desde: Date;
test.beforeEach(() => {
  // Unos segundos antes: el reloj del servidor puede ir apenas distinto.
  desde = new Date(Date.now() - 5_000);
});
test.afterEach(async ({ request }) => limpiarConversaciones(request, desde));

test("armar media venta, recargar la página, volver a la conversación y cobrarla", async ({ page, request }) => {
  const coca = await productoReal(request, "coca");
  await simularFrases(page, {
    "vendé 2 cocas": agregarAVenta(coca, 2),
    "cobrá con QR": propuesta({ intencion: "cobrar", entidades: { pago: "qr" } }),
  });
  await simularSugerencias(page);
  const cobros = await simularCobro(page, { total: coca.precio * 2 });

  await page.goto("/omnibox");
  await decir(page, "vendé 2 cocas");
  await expect(page).toHaveURL(/[?&]c=[0-9a-f-]{36}/);
  await guardada(page);
  await expect(page.getByTestId("conversacion-titulo")).toHaveText("Vendé 2 cocas");

  await page.reload();

  // Vuelve todo: el título, lo que se dijo y la venta a medio armar.
  await expect(page.getByTestId("conversacion-titulo")).toHaveText("Vendé 2 cocas");
  await expect(page.getByText("vendé 2 cocas", { exact: true })).toBeVisible();
  await expect(mesa(page).getByTestId("omnibox-total-venta")).toHaveText(`Bs ${dinero(coca.precio * 2)}`);

  await decir(page, "cobrá con QR");
  await expect.poll(() => cobros.length).toBe(1);
  const cobro = cobros[0].postDataJSON();
  expect(cobro.pago).toBe("qr");
  expect(cobro.lineas).toEqual([{ storeProductId: coca.storeProductId, cantidad: 2, precio: coca.precio }]);
});

test("el panel: nueva, abrir otra con su venta, buscar, renombrar y borrar", async ({ page, request }) => {
  const coca = await productoReal(request, "coca");
  const aceite = await productoReal(request, "aceite");
  await simularFrases(page, {
    "vendé 2 cocas para el panel": agregarAVenta(coca, 2),
    "vendé un aceite para el panel": agregarAVenta(aceite, 1),
  });
  await simularSugerencias(page);

  // Dos conversaciones, cada una con su venta.
  await page.goto("/omnibox");
  await decir(page, "vendé 2 cocas para el panel");
  await guardada(page);
  const primera = new URL(page.url()).searchParams.get("c")!;
  await page.getByTestId("omnibox-nueva").click();
  await expect(page).not.toHaveURL(/[?&]c=/);
  await expect(page.getByTestId("omnibox-vacio")).toBeVisible();
  await decir(page, "vendé un aceite para el panel");
  await guardada(page);
  // La nueva empezó con su propia venta, sin las cocas.
  await expect(mesa(page).getByTestId("omnibox-total-venta")).toHaveText(`Bs ${dinero(aceite.precio)}`);

  // El panel muestra las dos, con lo que quedó a medio armar.
  await page.getByTestId("omnibox-conversaciones").click();
  const panel = page.getByTestId("panel-conversaciones");
  const item = (titulo: string) => panel.getByTestId("conversacion-item").filter({ hasText: titulo });
  await expect(item("Vendé 2 cocas para el panel")).toContainText("Venta en curso · 1");
  await expect(item("Vendé un aceite para el panel")).toHaveAttribute("data-actual", "true");

  // Abrir la primera: vuelve su chat y su venta.
  await item("Vendé 2 cocas para el panel").getByRole("button").first().click();
  await expect(page).toHaveURL(new RegExp(`c=${primera}`));
  await expect(page.getByTestId("conversacion-titulo")).toHaveText("Vendé 2 cocas para el panel");
  await expect(mesa(page).getByTestId("omnibox-total-venta")).toHaveText(`Bs ${dinero(coca.precio * 2)}`);

  // Buscar por lo que se dijo (otras pruebas de la corrida también venden aceite).
  await page.getByTestId("omnibox-conversaciones").click();
  await panel.getByTestId("conversacion-buscar").fill("aceite para el panel");
  await expect(panel.getByTestId("conversacion-item")).toHaveCount(1);
  await expect(panel.getByTestId("conversacion-item")).toContainText("Vendé un aceite para el panel");
  await panel.getByTestId("conversacion-buscar").fill("");

  // Renombrar la abierta: también cambia arriba.
  await item("Vendé 2 cocas para el panel").getByTestId("conversacion-opciones").click();
  await page.getByTestId("conversacion-renombrar").click();
  await panel.getByTestId("conversacion-nombre").fill("Venta de José");
  await panel.getByTestId("conversacion-nombre").press("Enter");
  await expect(item("Venta de José")).toBeVisible();
  await expect(page.getByTestId("conversacion-titulo")).toHaveText("Venta de José");

  // Borrar la otra; después la abierta, y queda una conversación nueva.
  await item("Vendé un aceite para el panel").getByTestId("conversacion-opciones").click();
  await page.getByTestId("conversacion-borrar").click();
  await page.getByTestId("conversacion-borrar-confirmar").click();
  await expect(item("Vendé un aceite para el panel")).toHaveCount(0);
  await item("Venta de José").getByTestId("conversacion-opciones").click();
  await page.getByTestId("conversacion-borrar").click();
  await page.getByTestId("conversacion-borrar-confirmar").click();
  await expect(page).not.toHaveURL(/[?&]c=/);
  await expect(page.getByTestId("omnibox-vacio")).toBeVisible();
});

test("una conversación que ya no existe: lo dice y empieza una nueva", async ({ page }) => {
  await page.goto(`/omnibox?c=${crypto.randomUUID()}`);
  await expect(page.getByText("Esa conversación no existe o ya se borró.")).toBeVisible();
  await expect(page).not.toHaveURL(/[?&]c=/);
  await expect(page.getByTestId("omnibox-vacio")).toBeVisible();
});
