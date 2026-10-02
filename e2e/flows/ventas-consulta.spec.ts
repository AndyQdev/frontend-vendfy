import { expect, test } from "@playwright/test";

import { decir, ultimaRespuesta } from "../helpers/chat";
import { propuesta, simularFrases } from "../helpers/mock";

/**
 * "Cuánto vendí en agosto": la tarjeta dice el período con el nombre que le
 * pone el servidor (los mismos períodos que los análisis), no "últimos N días".
 */
test("cuánto vendí en un mes con nombre: la tarjeta dice el mes, el total y los pedidos", async ({ page }) => {
  await simularFrases(page, {
    "cuánto vendí en agosto": propuesta({
      intencion: "consultar_ventas",
      entidades: { periodo: "mes:2026-08" },
      resultado: { resumen: "Agosto: 166 pedidos por Bs 40156.00", datos: { pedidos: 166, total: 40156, periodo: "Agosto" } },
    }),
  });
  await page.goto("/omnibox");
  await decir(page, "cuánto vendí en agosto");
  const tarjeta = ultimaRespuesta(page);
  await expect(tarjeta).toContainText("Ventas · Agosto");
  await expect(tarjeta).toContainText("Bs 40.156,00");
  await expect(tarjeta).toContainText("166");
});
