import { expect, test } from "@playwright/test";

import type { TablaVista, VistaSpec } from "../../src/entities/omnibox/model/types";
import { hojasDeVista, nombreArchivo } from "../../src/features/omnibox/model/exportar";
import { MESA_INICIAL, mesaReducer, totalCompra } from "../../src/features/omnibox/model/mesa";
import {
  accionesReponer,
  alertaDe,
  comparar,
  diferenciasVista,
  mismaVista,
  paraReponer,
  productoDeFila,
} from "../../src/features/omnibox/model/vistas";

/**
 * G4 sin navegador: las alertas con regla fija, la comparativa, el puente a
 * la compra, lo que cambió entre dos versiones de una vista y el Excel.
 */

const tabla = (filas: Record<string, unknown>[]): TablaVista => ({ columnas: [], filas });

const fila = (id: string, nombre: string, extra: Record<string, unknown> = {}) => ({
  producto: nombre,
  _productId: `p-${id}`,
  _storeProductId: `sp-${id}`,
  _imagen: null,
  _precio: 10,
  _stock: 2,
  ...extra,
});

test.describe("alertas: regla fija, números de los datos", () => {
  test("stock: lo que se acaba en una semana o menos (o ya no hay)", () => {
    const a = alertaDe(
      "stock_bajo",
      tabla([
        { producto: "Coca", stock: 0, dias: null },
        { producto: "Arroz", stock: 3, dias: 5 },
        { producto: "Aceite", stock: 4, dias: 12 },
      ]),
    );
    expect(a).toEqual({ nivel: "advertencia", texto: "2 productos se acaban esta semana", detalle: "Coca, Arroz" });
  });

  test("stock: sin urgencias lo dice en verde, y sin filas también", () => {
    expect(alertaDe("stock_bajo", tabla([{ producto: "Aceite", stock: 4, dias: 12 }]))?.nivel).toBe("bien");
    expect(alertaDe("stock_bajo", tabla([]))).toEqual({ nivel: "bien", texto: "Ningún producto tiene poco stock" });
  });

  test("margen: menos de 15 % es advertencia; sin costos, lo dice en vez de inventar", () => {
    expect(alertaDe("margen_por_producto", tabla([{ producto: "Arroz", margen: 14.3 }, { producto: "Café", margen: 40 }]))?.texto).toBe(
      "1 producto deja menos de 15 % de margen",
    );
    expect(alertaDe("margen_por_producto", tabla([{ producto: "Arroz", margen: null }]))?.texto).toBe(
      "No se puede saber cuánto dejan: faltan los costos",
    );
  });

  test("ventas: bajaron, subieron, o sin nada con qué comparar", () => {
    const kpis = (valor: number, anterior: number) => tabla([{ indicador: "Ventas", valor, anterior, formato: "dinero" }]);
    expect(alertaDe("kpis", kpis(80, 100))).toEqual({ nivel: "advertencia", texto: "Las ventas bajaron 20 % contra el período anterior" });
    expect(alertaDe("kpis", kpis(130, 100))?.texto).toBe("Las ventas subieron 30 % contra el período anterior");
    expect(alertaDe("kpis", kpis(105, 100))?.texto).toBe("Las ventas se mantienen parecidas al período anterior");
    expect(alertaDe("kpis", kpis(0, 0))?.texto).toBe("No hubo ventas en este período ni en el anterior");
  });
});

test.describe("comparativa", () => {
  test("fila por fila, con diferencia y porcentaje; lo que falta en un lado vale cero", () => {
    const filas = comparar(
      [{ categoria: "Bebidas", monto: 150 }, { categoria: "Lácteos", monto: 20 }],
      [{ categoria: "Bebidas", monto: 100 }, { categoria: "Arroz", monto: 35 }],
      "categoria",
      "monto",
    );
    expect(filas).toEqual([
      { etiqueta: "Bebidas", a: 150, b: 100, diferencia: 50, pct: 50 },
      { etiqueta: "Arroz", a: 0, b: 35, diferencia: -35, pct: -100 },
      { etiqueta: "Lácteos", a: 20, b: 0, diferencia: 20, pct: null },
    ]);
  });
});

test.describe('"Reponer estos 3": el puente a la compra', () => {
  const filas = [
    fila("coca", "Coca", { _costo: 7.5, _sugerido: 24 }),
    fila("arroz", "Arroz", { _costo: null, _sugerido: 3 }),
    fila("aceite", "Aceite", { _costo: 12, _sugerido: 0 }),
    { producto: "Sin ids" },
  ];

  test("solo las filas que son productos del catálogo; al menos 1 unidad", () => {
    const items = paraReponer(filas);
    expect(items.map((i) => [i.producto.nombre, i.cantidad, i.costo])).toEqual([
      ["Coca", 24, 7.5],
      ["Arroz", 3, null],
      ["Aceite", 1, 12],
    ]);
    expect(productoDeFila({ producto: "x" })).toBeNull();
  });

  test("arma la compra con las mismas acciones que los botones y la abre; no registra nada", () => {
    const m = accionesReponer(paraReponer(filas)).reduce(mesaReducer, MESA_INICIAL);
    expect(m.abierta).toBe("compra");
    expect(m.pestana).toBe("borrador");
    expect(m.compra.lineas.map((l) => [l.nombre, l.cantidad, l.costo])).toEqual([
      ["Coca", 24, 7.5],
      ["Arroz", 3, 0],
      ["Aceite", 1, 12],
    ]);
    expect(totalCompra(m.compra)).toBe(24 * 7.5 + 12);
    // La venta no se toca.
    expect(m.venta.lineas).toEqual([]);
  });

  test("sin productos no hay acciones", () => {
    expect(accionesReponer([])).toEqual([]);
  });
});

const BASE: VistaSpec = {
  titulo: "Cómo vamos",
  piezas: [
    { id: "p1", tipo: "indicadores", fuente: "kpis", params: { periodo: "7dias" } },
    { id: "p2", tipo: "grafico", forma: "barras", fuente: "top_productos", params: { periodo: "7dias", limite: 5, orden: "monto" }, x: "producto", y: ["monto"], titulo: "Lo más vendido" },
    { id: "p3", tipo: "conclusion" },
  ],
};

test.describe("qué cambió entre dos versiones de una vista", () => {
  test("agregar y sacar piezas", () => {
    const despues: VistaSpec = {
      ...BASE,
      piezas: [
        BASE.piezas[0],
        { id: "p2", tipo: "grafico", forma: "torta", fuente: "ventas_por_categoria", params: { periodo: "7dias" }, x: "categoria", y: ["monto"], titulo: "Por categoría" },
        BASE.piezas[2],
      ],
    };
    expect(diferenciasVista(BASE, despues)).toEqual(["Saqué: Lo más vendido", "Agregué: Por categoría"]);
  });

  test("otro período y otra forma de gráfico", () => {
    const despues: VistaSpec = {
      ...BASE,
      piezas: [
        { ...BASE.piezas[0], params: { periodo: "este_mes" } } as any,
        { ...BASE.piezas[1], forma: "lineas", params: { periodo: "este_mes", limite: 5, orden: "monto" } } as any,
        BASE.piezas[2],
      ],
    };
    expect(diferenciasVista(BASE, despues)).toEqual(["Ahora en líneas: Lo más vendido", "Período: Este mes"]);
  });

  test("si nada cambió, nada que anunciar", () => {
    expect(diferenciasVista(BASE, structuredClone(BASE))).toEqual([]);
  });

  test("misma vista aunque cambie el orden de las claves (para saber si ya está fijada)", () => {
    const reordenada = JSON.parse(JSON.stringify(BASE), (_, v) =>
      v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v,
    );
    expect(mismaVista(BASE, reordenada)).toBe(true);
    expect(mismaVista(BASE, { ...BASE, piezas: BASE.piezas.slice(0, 2) })).toBe(false);
  });
});

test.describe("exportar a Excel", () => {
  test("una hoja de resumen y una por pieza, con todas las filas", () => {
    const hojas = hojasDeVista(
      BASE,
      {
        p1: { columnas: [], filas: [{ indicador: "Ventas", valor: 125, anterior: 100, formato: "dinero" }] },
        p2: {
          columnas: [
            { clave: "producto", titulo: "Producto", tipo: "producto" },
            { clave: "unidades", titulo: "Unidades", tipo: "numero" },
            { clave: "monto", titulo: "Vendido", tipo: "dinero" },
          ],
          filas: Array.from({ length: 12 }, (_, i) => ({ producto: `P${i}`, unidades: i, monto: i * 10, _productId: "x" })),
        },
      },
      { pregunta: "cómo vamos", tienda: "Abarrotes Don Juan", fecha: new Date(2026, 9, 1, 10, 5), conclusion: "Vendiste más." },
    );
    expect(hojas.map((h) => h.nombre)).toEqual(["Resumen", "Indicadores", "Lo más vendido"]);
    expect(hojas[0].filas).toContainEqual(["Generado", "01/10/2026 10:05"]);
    expect(hojas[0].filas).toContainEqual(["Conclusión", "Vendiste más."]);
    expect(hojas[1].filas[0]).toEqual(["Ventas", 125, 100, 25]);
    // Todas las filas (no las 8 de la pantalla) y sin las columnas ocultas.
    expect(hojas[2].filas).toHaveLength(12);
    expect(hojas[2].columnas.map((c) => c.tipo)).toEqual(["texto", "numero", "dinero"]);
  });

  test("el nombre del archivo, sin acentos ni espacios", () => {
    expect(nombreArchivo("Cómo vamos este año", new Date(2026, 9, 1), "xlsx")).toBe("como-vamos-este-ano-2026-10-01.xlsx");
  });
});
