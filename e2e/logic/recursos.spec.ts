import { expect, test } from "@playwright/test";

import { celda, fechaCorta, hojaDeLista, ordenDeColumna, resumenLista, siguienteOrden, sinFiltro, tonoDe } from "../../src/features/omnibox/model/recursos";

/** Listas y fichas del chat (G9a): cómo se lee cada celda y cómo se ordena. */
test.describe("las listas del chat", () => {
  test("cada celda como se lee", () => {
    expect(celda(4861, "dinero")).toBe("Bs 4.861,00");
    expect(celda("2026-09-26 08:30", "fecha")).toBe("26/09/26 08:30");
    expect(celda(null, "texto")).toBe("—");
    expect(celda(1234, "numero")).toBe("1.234");
    expect(fechaCorta("2026-09-26")).toBe("26/09/26");
  });

  test("el color de un estado sale de lo que dice", () => {
    expect(tonoDe("Completada")).toBe("exito");
    expect(tonoDe("Cancelada")).toBe("error");
    expect(tonoDe("Pendiente")).toBe("aviso");
    expect(tonoDe("Oculto")).toBe("neutro");
  });

  test("ordenar tocando la columna: la misma da vuelta el sentido", () => {
    const ordenes = { fecha: "Fecha", total: "Total", nombre: "Nombre" };
    expect(ordenDeColumna("total", ordenes)).toBe("total");
    expect(ordenDeColumna("producto", ordenes)).toBe("nombre");
    expect(ordenDeColumna("pago", ordenes)).toBeNull();
    expect(siguienteOrden({ campo: "fecha", sentido: "desc" }, "fecha")).toEqual({ campo: "fecha", sentido: "asc" });
    expect(siguienteOrden({ campo: "fecha", sentido: "desc" }, "total")).toEqual({ campo: "total", sentido: "desc" });
    expect(siguienteOrden({ campo: "fecha", sentido: "desc" }, "nombre")).toEqual({ campo: "nombre", sentido: "asc" });
  });

  test("sacar un chip; el de las fechas saca el rango entero", () => {
    expect(sinFiltro({ desde: "2026-09-01", hasta: "2026-09-30", pago: "qr" }, "fechas")).toEqual({ pago: "qr" });
    expect(sinFiltro({ pago: "qr", cliente: "Marta" }, "pago")).toEqual({ cliente: "Marta" });
  });

  test("el resumen y el Excel salen de lo que se ve", () => {
    const lista = {
      titulo: "Compras",
      singular: "compra",
      resumen: { total: 1, suma: 4861 },
      columnas: [
        { clave: "fecha", etiqueta: "Fecha", formato: "fecha" as const },
        { clave: "total", etiqueta: "Total", formato: "dinero" as const },
      ],
      filas: [{ _id: "x", fecha: "2026-09-26 08:30", total: 4861 }],
    };
    expect(resumenLista(lista)).toBe("1 compra · Bs 4.861,00");
    const hoja = hojaDeLista(lista);
    expect(hoja.columnas.map((c) => c.tipo)).toEqual(["texto", "dinero"]);
    expect(hoja.filas).toEqual([["26/09/26 08:30", 4861]]);
  });
});
