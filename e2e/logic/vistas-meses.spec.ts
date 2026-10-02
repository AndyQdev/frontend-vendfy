import { expect, test } from "@playwright/test";

import { alertaDe, contraQue, etiquetaPeriodo, opcionesPeriodo } from "../../src/features/omnibox/model/vistas";

/**
 * Lo que apareció al probar con una tienda con historia (4 meses de ventas):
 * "septiembre contra agosto" necesita meses con nombre, y "qué no se vende"
 * su propia fuente con su alerta.
 */

test.describe("un mes con nombre", () => {
  const OCT = new Date("2026-10-02T12:00:00");

  test("se lee como el mes, con el año si no es este", () => {
    expect(etiquetaPeriodo("mes:2026-08", OCT)).toBe("Agosto");
    expect(etiquetaPeriodo("mes:2025-12", OCT)).toBe("Diciembre de 2025");
    expect(etiquetaPeriodo("30dias", OCT)).toBe("Últimos 30 días");
  });

  test("se compara con el mes anterior", () => {
    expect(contraQue("mes:2026-09")).toBe("vs. el mes anterior");
  });

  test("el selector lo ofrece (elegido) además de los de siempre", () => {
    const op = opcionesPeriodo("mes:2026-09");
    expect(op[0].id).toBe("mes:2026-09");
    expect(op.map((o) => o.id)).toContain("30dias");
    expect(opcionesPeriodo("30dias").map((o) => o.id)).not.toContain("mes:2026-09");
  });
});

test.describe("lo que no se vende", () => {
  const tabla = (filas: Record<string, unknown>[]) => ({ columnas: [], filas });

  test("los que no se vendieron, con la plata parada a costo", () => {
    const a = alertaDe(
      "sin_ventas",
      tabla([
        { producto: "Agua micelar", vendidas: 0, stock: 9, parado: 378 },
        { producto: "Sauvage", vendidas: 0, stock: 20, parado: 6000 },
        { producto: "Bleu de Chanel", vendidas: 4, stock: 9, parado: 5895 },
      ]),
    );
    expect(a).toEqual({ nivel: "advertencia", texto: "2 productos no se vendieron en este período · Bs 6.378,00 parados", detalle: "Agua micelar, Sauvage" });
  });

  test("si todo se movió, se dice", () => {
    expect(alertaDe("sin_ventas", tabla([{ producto: "Coca", vendidas: 3, stock: 2, parado: null }]))?.texto).toBe(
      "Todo lo que tenés en stock se vendió en este período",
    );
  });
});
