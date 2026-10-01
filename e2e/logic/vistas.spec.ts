import { expect, test } from "@playwright/test";

import type { ProductoOpcion, VistaSpec } from "../../src/entities/omnibox/model/types";
import { MESA_INICIAL, mesaReducer, type AccionMesa, type Mesa } from "../../src/features/omnibox/model/mesa";
import {
  barrasAcostadas,
  compacto,
  conPeriodo,
  contraQue,
  etiquetaFecha,
  hayDatos,
  periodoComun,
  porciones,
  puestos,
  resumenPiezas,
  valorConFormato,
  variacion,
} from "../../src/features/omnibox/model/vistas";

/**
 * Las vistas del asistente (G3), sin navegador: cómo se lee cada número y
 * cómo vive el análisis en el panel junto a la venta y la compra.
 */

const VISTA: VistaSpec = {
  titulo: "Lo más vendido de la semana",
  piezas: [
    { id: "p1", tipo: "indicadores", fuente: "kpis", params: { periodo: "7dias" } },
    { id: "p2", tipo: "ranking", fuente: "top_productos", params: { periodo: "7dias", limite: 5, orden: "monto" }, etiqueta: "producto", valor: "monto", titulo: "Top 5" },
    { id: "p3", tipo: "tabla", fuente: "stock_bajo", params: { limite: 10 }, titulo: "Por acabarse" },
    { id: "p4", tipo: "conclusion" },
  ],
};

test.describe("formato", () => {
  test("plata con centavos y en formato boliviano", () => {
    expect(valorConFormato(1234.5, "dinero")).toBe("Bs 1.234,50");
    expect(valorConFormato(33.333, "porcentaje")).toBe("33,3 %");
    expect(valorConFormato(12, "numero")).toBe("12");
    expect(valorConFormato(null, "dinero")).toBe("—");
  });

  test("los ejes no llevan centavos: Bs 1,2 mil, 1,5 M", () => {
    expect(compacto(1234, "dinero")).toBe("Bs 1,2 mil");
    expect(compacto(1_500_000, "numero")).toBe("1,5 M");
    expect(compacto(35, "dinero")).toBe("Bs 35");
  });

  test("una fecha no se corre un día (2026-09-25 es el 25 en Bolivia)", () => {
    expect(etiquetaFecha("2026-09-25")).toBe("25 sep");
    expect(etiquetaFecha("2026-09-01", "mes")).toBe("sep");
    expect(valorConFormato("2026-01-01", "fecha", "mes")).toBe("ene 2026");
  });
});

test.describe("indicadores", () => {
  test("la variación contra el período anterior, con un decimal", () => {
    expect(variacion(125, 100)).toEqual({ pct: 25, direccion: "sube" });
    expect(variacion(80, 100)).toEqual({ pct: -20, direccion: "baja" });
    expect(variacion(100, 100)).toEqual({ pct: 0, direccion: "igual" });
  });

  test("sin período anterior no hay porcentaje (no se inventa un +∞ %)", () => {
    expect(variacion(105, 0)).toBeNull();
    expect(variacion(105, null)).toBeNull();
  });

  test("cada período dice contra qué se compara", () => {
    expect(contraQue("7dias")).toBe("vs. los 7 días anteriores");
    expect(contraQue("este_mes")).toBe("vs. el mes pasado");
  });
});

test.describe("gráficos", () => {
  test("la torta tiene seis porciones como mucho: el resto va a Otros", () => {
    const filas = ["a", "b", "c", "d", "e", "f", "g", "h"].map((x, i) => ({ categoria: x, monto: 80 - i * 10 }));
    const p = porciones(filas, "categoria", "monto");
    expect(p).toHaveLength(6);
    expect(p[5]).toMatchObject({ nombre: "Otros", valor: 30 + 20 + 10, otros: true });
    expect(p.reduce((s, x) => s + x.parte, 0)).toBeCloseTo(100, 0);
  });

  test("lo que es cero no tiene porción", () => {
    expect(porciones([{ m: "QR", v: 50 }, { m: "Efectivo", v: 0 }], "m", "v").map((p) => p.nombre)).toEqual(["QR"]);
  });

  test("barras de nombres van acostadas; las de fechas, paradas", () => {
    expect(barrasAcostadas("producto")).toBe(true);
    expect(barrasAcostadas("fecha")).toBe(false);
    expect(barrasAcostadas("hora")).toBe(false);
  });

  test("una serie toda en cero es 'no hubo ventas', no un gráfico plano", () => {
    expect(hayDatos([{ ventas: 0 }, { ventas: 0 }], ["ventas"])).toBe(false);
    expect(hayDatos([{ ventas: 0 }, { ventas: 55 }], ["ventas"])).toBe(true);
  });

  test("el ranking ordena y mide cada barra contra el primero", () => {
    const r = puestos(
      [
        { producto: "Arroz", monto: 35, _imagen: "a.jpg" },
        { producto: "Aceite", monto: 70, _imagen: null },
      ],
      "producto",
      "monto",
    );
    expect(r.map((p) => [p.etiqueta, p.proporcion])).toEqual([
      ["Aceite", 1],
      ["Arroz", 0.5],
    ]);
    expect(r[1].imagen).toBe("a.jpg");
  });
});

test.describe("el período de la vista", () => {
  test("si todas las piezas miran el mismo período, ese es el de la vista", () => {
    // stock_bajo no tiene período: no cuenta.
    expect(periodoComun(VISTA)).toBe("7dias");
  });

  test("cambiarlo cambia todas las piezas que tienen período, y nada más", () => {
    const v = conPeriodo(VISTA, "este_mes");
    expect(v.piezas.map((p) => ("params" in p ? p.params.periodo : undefined))).toEqual([
      "este_mes",
      "este_mes",
      undefined,
      undefined,
    ]);
    expect((v.piezas[1] as any).params.limite).toBe(5);
  });

  test("con piezas en períodos distintos no hay uno solo que cambiar", () => {
    const mezclada: VistaSpec = {
      ...VISTA,
      piezas: [VISTA.piezas[0], { ...(VISTA.piezas[1] as any), params: { periodo: "mes_pasado" } }],
    };
    expect(periodoComun(mezclada)).toBeNull();
  });

  test("la tarjeta del chat dice qué trae la vista", () => {
    expect(resumenPiezas(VISTA)).toEqual(["Indicadores", "Ranking", "Tabla", "Conclusión"]);
  });
});

test.describe("el análisis en el panel", () => {
  const aplicar = (...acciones: AccionMesa[]): Mesa => acciones.reduce(mesaReducer, MESA_INICIAL);
  const analizar: AccionMesa = { tipo: "analizar", analisis: { mensajeId: "m1", pregunta: "qué se vendió más", vista: VISTA } };
  const coca: ProductoOpcion = {
    storeProductId: "sp-coca",
    productId: "coca",
    nombre: "Coca",
    codigo: null,
    imagen: null,
    precio: 10,
    stock: 5,
    similitud: 1,
  };

  test("una pregunta de análisis abre el panel en el análisis", () => {
    const m = aplicar(analizar);
    expect(m.abierta).toBe("analisis");
    expect(m.analisis?.mensajeId).toBe("m1");
  });

  test("ir a la venta no pierde el análisis: queda en su pestaña", () => {
    const m = aplicar(analizar, { tipo: "agregarVenta", producto: coca }, { tipo: "abrir", mesa: "venta", pestana: "borrador" });
    expect(m.abierta).toBe("venta");
    expect(m.analisis?.vista.titulo).toBe(VISTA.titulo);
    expect(mesaReducer(m, { tipo: "abrir", mesa: "analisis" }).abierta).toBe("analisis");
  });

  test("sin análisis, la pestaña no abre nada", () => {
    expect(aplicar({ tipo: "abrir", mesa: "analisis" }).abierta).toBeNull();
  });

  test("ver un producto desde el análisis lo muestra en la mesa con la que se venía trabajando", () => {
    const m = aplicar(
      { tipo: "agregarCompra", producto: coca, costo: 7, costoAnterior: null },
      analizar,
      { tipo: "verProducto", producto: coca },
    );
    expect(m.abierta).toBe("compra");
    expect(m.pestana).toBe("producto");
  });

  test("cerrar el panel tampoco lo borra", () => {
    const m = aplicar(analizar, { tipo: "cerrar" });
    expect(m.abierta).toBeNull();
    expect(m.analisis).not.toBeNull();
  });

  test("el filtro de período cambia la vista del análisis", () => {
    const m = aplicar(analizar, { tipo: "periodoAnalisis", periodo: "30dias" });
    expect(periodoComun(m.analisis!.vista)).toBe("30dias");
  });

  test("el análisis no se mete en la venta ni en la compra", () => {
    const m = aplicar({ tipo: "agregarVenta", producto: coca, cantidad: 2 }, analizar);
    expect(m.venta.lineas).toHaveLength(1);
    expect(m.ultima).toBe("venta");
  });
});
