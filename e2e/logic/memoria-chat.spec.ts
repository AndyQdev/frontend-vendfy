import { expect, test } from "@playwright/test";

import type { Propuesta } from "../../src/entities/omnibox/model/types";
import { memoriaDe, respuestaDe } from "../../src/features/omnibox/model/memoria-chat";
import { nuevoMensaje, propuestaLocal, type Mensaje } from "../../src/features/omnibox/model/mensaje";

/** La memoria corta (G6b): qué viaja con cada frase para que "esas" o "su teléfono" se entiendan. */

const JOSE = { id: "11111111-1111-4111-8111-111111111111", nombre: "José Luis Mamani" };
const listo = (texto: string, p: Partial<Propuesta> & { intencion: string }): Mensaje => ({
  ...nuevoMensaje(texto, false),
  fase: "listo",
  propuesta: propuestaLocal(p.intencion, p),
});

test("cada turno en una línea: el análisis dice de quién era", () => {
  const m = listo("ventas de José", {
    intencion: "analizar",
    vista: { titulo: "Ventas de José Luis Mamani", piezas: [{ id: "p1", tipo: "conclusion" }], filtros: { cliente: JOSE } },
  });
  expect(respuestaDe(m)).toBe('Análisis "Ventas de José Luis Mamani" (Cliente: José Luis Mamani)');
});

test("los últimos 4 y el foco del ÚLTIMO análisis (si fue de toda la tienda, ya no se habla de José)", () => {
  const deJose = listo("ventas de José", {
    intencion: "analizar",
    vista: { titulo: "José", piezas: [{ id: "p1", tipo: "conclusion" }], filtros: { cliente: JOSE } },
  });
  const otros = Array.from({ length: 4 }, (_, i) => listo(`cuánto vendí ${i}`, { intencion: "consultar_ventas", resultado: { resumen: `r${i}` } }));
  const mem = memoriaDe([deJose, ...otros]);
  expect(mem.historial.map((t) => t.dijo)).toEqual(["cuánto vendí 0", "cuánto vendí 1", "cuánto vendí 2", "cuánto vendí 3"]);
  expect(mem.foco).toEqual({ cliente: JOSE });

  const deTodos = listo("lo que más vendo", { intencion: "analizar", vista: { titulo: "Top", piezas: [{ id: "p1", tipo: "conclusion" }] } });
  expect(memoriaDe([deJose, deTodos]).foco).toBeUndefined();
});

test("lo que todavía se está pensando no entra (es la frase de ahora)", () => {
  expect(memoriaDe([nuevoMensaje("su teléfono 71890031", false)]).historial).toEqual([]);
});
