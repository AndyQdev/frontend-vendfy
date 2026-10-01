import { expect, test } from "@playwright/test";

import type { ProductoOpcion } from "../../src/entities/omnibox/model/types";
import { MENSAJES, cantidadNoDichaVigente, deSugerencia, revisarVenta, type MensajeGuia } from "../../src/features/omnibox/model/guia";
import {
  CONFIANZA_MINIMA,
  DESCARTES_PARA_SILENCIAR,
  MEMORIA_VACIA,
  OLVIDO_DESCARTE,
  SILENCIO,
  VENTAS_APRENDIZ,
  aceptar,
  contarVenta,
  descartar,
  leerMemoria,
  permitida,
  tipVisto,
} from "../../src/features/omnibox/model/memoria-guia";
import { MESA_INICIAL, mesaReducer } from "../../src/features/omnibox/model/mesa";

/**
 * Fase G2a · que la Guía ayude sin molestar. Una sugerencia que vuelve
 * después de un "no, gracias" es la forma más rápida de que dejen de leerla.
 */

const AHORA = 1_790_000_000_000;

const sugerencia = (x: Partial<MensajeGuia> = {}): MensajeGuia =>
  deSugerencia({
    codigo: "QUEDA_POCO",
    mesa: "venta",
    texto: "Después de esta venta te quedan 2.",
    acciones: [{ tipo: "descartar", etiqueta: "Ahora no" }],
    confianza: 0.7,
    clave: "QUEDA_POCO:a",
    ...(x as any),
  });

test.describe("permitida", () => {
  test("errores y advertencias se dicen siempre: la memoria es solo para sugerencias", () => {
    const mem = descartar(descartar(descartar(MEMORIA_VACIA, MENSAJES.faltaPago(), AHORA), MENSAJES.faltaPago(), AHORA), MENSAJES.faltaPago(), AHORA);
    expect(permitida(MENSAJES.faltaPago(), mem, AHORA)).toBe(true);
  });

  test("por debajo de la confianza mínima no se dice", () => {
    expect(permitida(sugerencia({ confianza: CONFIANZA_MINIMA - 0.01 }), MEMORIA_VACIA, AHORA)).toBe(false);
    expect(permitida(sugerencia({ confianza: CONFIANZA_MINIMA }), MEMORIA_VACIA, AHORA)).toBe(true);
  });
});

test.describe("no, gracias", () => {
  test("la misma sugerencia descartada no vuelve… hasta que pasa el olvido", () => {
    const mem = descartar(MEMORIA_VACIA, sugerencia(), AHORA);
    expect(permitida(sugerencia(), mem, AHORA + 60_000)).toBe(false);
    expect(permitida(sugerencia(), mem, AHORA + OLVIDO_DESCARTE + 1)).toBe(true);
  });

  test("otra del mismo tipo (otro producto) sí puede aparecer", () => {
    const mem = descartar(MEMORIA_VACIA, sugerencia(), AHORA);
    expect(permitida(sugerencia({ clave: "QUEDA_POCO:b" }), mem, AHORA)).toBe(true);
  });

  test(`${DESCARTES_PARA_SILENCIAR} descartes seguidos del mismo tipo lo silencian 30 días`, () => {
    let mem = MEMORIA_VACIA;
    for (let i = 0; i < DESCARTES_PARA_SILENCIAR; i++) mem = descartar(mem, sugerencia({ clave: `QUEDA_POCO:${i}` }), AHORA);
    const otra = sugerencia({ clave: "QUEDA_POCO:nueva" });
    expect(permitida(otra, mem, AHORA + 1000)).toBe(false);
    expect(permitida(otra, mem, AHORA + SILENCIO + 1)).toBe(true);
    // Otro tipo no queda afectado.
    expect(permitida(sugerencia({ codigo: "DESCUENTO" as any, clave: "DESCUENTO:a" }), mem, AHORA)).toBe(true);
  });

  test("aceptar una reinicia la racha: le sirvió", () => {
    let mem = descartar(MEMORIA_VACIA, sugerencia({ clave: "QUEDA_POCO:1" }), AHORA);
    mem = descartar(mem, sugerencia({ clave: "QUEDA_POCO:2" }), AHORA);
    mem = aceptar(mem, sugerencia({ clave: "QUEDA_POCO:3" }));
    mem = descartar(mem, sugerencia({ clave: "QUEDA_POCO:4" }), AHORA);
    expect(permitida(sugerencia({ clave: "QUEDA_POCO:5" }), mem, AHORA)).toBe(true);
  });
});

test.describe("modo aprendiz", () => {
  test("un tip sale una sola vez", () => {
    const tip = MENSAJES.tipDecirCantidad();
    expect(permitida(tip, MEMORIA_VACIA, AHORA)).toBe(true);
    expect(permitida(tip, tipVisto(MEMORIA_VACIA, tip.codigo), AHORA)).toBe(false);
  });

  test(`después de ${VENTAS_APRENDIZ} ventas no hay más tips (las sugerencias siguen)`, () => {
    let mem = MEMORIA_VACIA;
    for (let i = 0; i < VENTAS_APRENDIZ; i++) mem = contarVenta(mem);
    expect(permitida(MENSAJES.tipCobrarHablando(), mem, AHORA)).toBe(false);
    expect(permitida(sugerencia(), mem, AHORA)).toBe(true);
  });

  test("lo guardado roto o de otra versión no rompe nada", () => {
    expect(leerMemoria("{no es json")).toEqual(MEMORIA_VACIA);
    expect(leerMemoria(null)).toEqual(MEMORIA_VACIA);
    expect(leerMemoria(JSON.stringify({ ventas: "x", tips: null })).ventas).toBe(0);
  });
});

test.describe('"no dijiste cuántas"', () => {
  const coca: ProductoOpcion = {
    storeProductId: "sp-coca",
    productId: "coca",
    nombre: "Coca Cola 2L",
    codigo: null,
    imagen: null,
    precio: 12,
    stock: 20,
    similitud: 1,
  };

  test("ofrece números a un toque y 'Es 1' para dejarlo", () => {
    const m = MENSAJES.cantidadNoDicha(coca, "venta");
    expect(m.texto).toBe("No dijiste cuántas de Coca Cola 2L: puse 1. ¿Son más?");
    expect(m.acciones.map((a) => a.etiqueta)).toEqual(["2", "3", "6", "Es 1"]);
    // En la compra se compran cajas: otros números.
    expect(MENSAJES.cantidadNoDicha(coca, "compra").acciones.map((a) => a.etiqueta)).toEqual(["6", "12", "24", "Es 1"]);
  });

  test("calla apenas la cantidad cambia (tocando o hablando) o la línea se va", () => {
    const m = MENSAJES.cantidadNoDicha(coca, "venta");
    const una = mesaReducer(MESA_INICIAL, { tipo: "agregarVenta", producto: coca });
    expect(cantidadNoDichaVigente(m, una.venta, una.compra)).toBe(true);
    const tres = mesaReducer(una, { tipo: "cantidadVenta", productId: "coca", cantidad: 3 });
    expect(cantidadNoDichaVigente(m, tres.venta, tres.compra)).toBe(false);
    const fuera = mesaReducer(una, { tipo: "quitarVenta", productId: "coca" });
    expect(cantidadNoDichaVigente(m, fuera.venta, fuera.compra)).toBe(false);
  });
});

test("sin stock ofrece 'Cargar compra' de lo que falta (D3)", () => {
  const m = mesaReducer(MESA_INICIAL, {
    tipo: "agregarVenta",
    producto: { storeProductId: "sp-a", productId: "a", nombre: "Aceite", codigo: null, imagen: null, precio: 18, stock: 2, similitud: 1 },
    cantidad: 5,
  });
  const aviso = revisarVenta(m.venta).find((x) => x.codigo === "SIN_STOCK")!;
  const comprar = aviso.acciones.find((a) => a.tipo === "comprar");
  expect(comprar).toMatchObject({ tipo: "comprar", cantidad: 3, etiqueta: "Cargar compra", producto: { storeProductId: "sp-a" } });
});
