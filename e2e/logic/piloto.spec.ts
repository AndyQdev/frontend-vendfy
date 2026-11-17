import { expect, test } from "@playwright/test";

import type { ItemPedido, ProductoOpcion, Propuesta } from "../../src/entities/omnibox/model/types";
import { planDe, resumenAgregado } from "../../src/features/piloto/model/plan";
import { leerRespuesta } from "../../src/features/piloto/model/respuestas";

/**
 * El piloto ("Oye Vendfy") sin navegador: qué entiende de una respuesta corta
 * y qué hace en la Caja con lo que entendió el servidor.
 */

const coca: ProductoOpcion = {
  storeProductId: "sp-coca",
  productId: "p-coca",
  nombre: "Coca Cola 2L",
  codigo: null,
  imagen: null,
  precio: 12,
  stock: 20,
  similitud: 1,
};
const fanta: ProductoOpcion = { ...coca, storeProductId: "sp-fanta", productId: "p-fanta", nombre: "Fanta 2L", precio: 10 };

function propuesta(over: Partial<Propuesta>): Propuesta {
  return {
    intencion: null,
    titulo: null,
    confianza: 0.9,
    capa: "C0",
    entidades: {},
    faltan: [],
    opciones: [],
    noEncontrado: null,
    requiereConfirmacion: false,
    vistaPrevia: null,
    ejecutable: true,
    resultado: null,
    aviso: null,
    producto: null,
    bloqueo: null,
    ...over,
  } as Propuesta;
}

const item = (producto: ProductoOpcion | null, cantidad: number, buscado = producto?.nombre ?? ""): ItemPedido => ({
  texto: buscado,
  buscado,
  cantidad,
  precio: null,
  producto,
  opciones: [],
  noEncontrado: producto ? null : buscado,
});

test.describe("respuestas cortas", () => {
  test("el método de pago, dicho de varias formas", () => {
    expect(leerRespuesta("Con QR.", "pago")).toEqual({ tipo: "pago", pago: "qr", confirma: false });
    expect(leerRespuesta("en efectivo", "pago")).toMatchObject({ pago: "efectivo" });
    expect(leerRespuesta("tarjeta de débito", "pago")).toMatchObject({ pago: "tarjeta" });
    expect(leerRespuesta("paga en dólares", "pago")).toMatchObject({ pago: "dolares" });
    expect(leerRespuesta("con Simple", "pago")).toMatchObject({ pago: "qr" });
  });

  test('"sí, con QR" y "cóbrale con QR" ya confirman', () => {
    expect(leerRespuesta("Sí, con QR", "confirmar")).toEqual({ tipo: "pago", pago: "qr", confirma: true });
    expect(leerRespuesta("cóbrale con tarjeta", null)).toEqual({ tipo: "pago", pago: "tarjeta", confirma: true });
  });

  test('"sí" en sus formas, también el "C." que a veces escribe Whisper', () => {
    for (const t of ["Sí.", "sí, por favor", "dale", "Claro", "C.", "ok"]) expect(leerRespuesta(t, "confirmar")).toEqual({ tipo: "si" });
  });

  test('"no", "nada" y "eso es todo"', () => {
    for (const t of ["No.", "nada", "Eso es todo", "todavía no"]) expect(leerRespuesta(t, "seguir")).toEqual({ tipo: "no" });
  });

  test("parar y cobrar", () => {
    expect(leerRespuesta("Para.", null)).toEqual({ tipo: "parar" });
    expect(leerRespuesta("cancela", "confirmar")).toEqual({ tipo: "parar" });
    expect(leerRespuesta("Cóbrale.", null)).toEqual({ tipo: "cobrar" });
  });

  test("un pedido no es una respuesta: va al servidor", () => {
    expect(leerRespuesta("y una fanta más", "seguir")).toBeNull();
    expect(leerRespuesta("véndele dos coca cola de dos litros y una fanta grande por favor", "seguir")).toBeNull();
    expect(leerRespuesta("", "pago")).toBeNull();
  });
});

test.describe("de lo entendido a la Caja", () => {
  test("una venta de varias cosas carga cada producto", () => {
    const plan = planDe(propuesta({ intencion: "agregar_a_venta", items: [item(coca, 2), item(fanta, 1)] }));
    expect(plan).toMatchObject({ tipo: "caja", cobrar: false });
    if (plan.tipo !== "caja") throw new Error();
    expect(plan.acciones.map((a) => a.tipo)).toEqual(["agregar", "agregar"]);
    expect(resumenAgregado(plan.acciones)).toBe("2 Coca Cola 2L y 1 Fanta 2L");
  });

  test("un solo producto con el pago dicho", () => {
    const plan = planDe(propuesta({ intencion: "agregar_a_venta", producto: coca, entidades: { cantidad: 3 } }));
    expect(plan).toMatchObject({ tipo: "caja", acciones: [{ tipo: "agregar", cantidad: 3 }] });
  });

  test('"cóbrale con QR" cobra', () => {
    expect(planDe(propuesta({ intencion: "cobrar", entidades: { pago: "qr" } }))).toEqual({
      tipo: "caja",
      acciones: [{ tipo: "pago", pago: "qr", recibidoUsd: null }],
      cobrar: true,
    });
  });

  test("sacar, cambiar la cantidad y empezar de nuevo", () => {
    expect(planDe(propuesta({ intencion: "quitar_de_venta", entidades: { productId: "p-coca", producto: "Coca Cola 2L" } }))).toMatchObject({
      acciones: [{ tipo: "quitar", productId: "p-coca" }],
    });
    expect(
      planDe(propuesta({ intencion: "cambiar_cantidad_venta", entidades: { productId: "p-coca", producto: "Coca Cola 2L", cantidad: 5 } })),
    ).toMatchObject({ acciones: [{ tipo: "cantidad", cantidad: 5 }] });
    expect(planDe(propuesta({ intencion: "vaciar_venta" }))).toMatchObject({ acciones: [{ tipo: "vaciar" }] });
  });

  test("lo que no existe o es dudoso se dice, no se inventa", () => {
    expect(planDe(propuesta({ intencion: "agregar_a_venta", items: [item(null, 1, "pepsi")] }))).toEqual({
      tipo: "decir",
      texto: "No encontré pepsi en tus productos.",
    });
    expect(planDe(propuesta({ intencion: "agregar_a_venta", opciones: [coca, fanta] }))).toEqual({
      tipo: "decir",
      texto: "¿Cuál? Tengo Coca Cola 2L, Fanta 2L.",
    });
  });

  test("delivery, cuotas y compras quedan en el asistente", () => {
    const conEntrega = propuesta({ intencion: "agregar_a_venta", items: [item(coca, 1)], entidades: { entrega: { direccion: "Av. Banzer" } } });
    expect(planDe(conEntrega).tipo).toBe("asistente");
    expect(planDe(propuesta({ intencion: "agregar_a_compra", items: [item(coca, 12)] })).tipo).toBe("asistente");
  });

  test("una consulta que el servidor ya contestó se dice", () => {
    const p = propuesta({ intencion: "consultar_dolar", resultado: { resumen: "El dólar está a Bs 11,70." } });
    expect(planDe(p)).toEqual({ tipo: "decir", texto: "El dólar está a Bs 11,70." });
  });

  test("sin permiso, lo dice", () => {
    expect(planDe(propuesta({ intencion: "cobrar", bloqueo: "sin-permiso" }))).toMatchObject({ tipo: "decir" });
  });
});

test.describe("lo que no se confunde", () => {
  test('"¿a cuánto está el dólar?" es una consulta, no un pago', () => {
    expect(leerRespuesta("¿A cuánto está el dólar?", null)).toBeNull();
    expect(leerRespuesta("a cuanto esta el dolar", "seguir")).toBeNull();
    // Sin pregunta, "dólares" solo no es un pago; "paga en dólares", sí.
    expect(leerRespuesta("dólares", null)).toBeNull();
    expect(leerRespuesta("paga en dólares", null)).toMatchObject({ pago: "dolares" });
    expect(leerRespuesta("dólares", "pago")).toMatchObject({ pago: "dolares" });
  });

  test("el agente (C4): lo de la venta va a la Caja, lo demás al asistente con su texto", () => {
    const vender = propuesta({ intencion: "agregar_a_venta", items: [item(coca, 1)] });
    const crear = propuesta({ intencion: "crear_producto", entidades: { productos: [{ nombre: "Cerveza Paceña" }] } });
    expect(planDe(propuesta({ intencion: "agente", agente: { texto: "Te lo agrego.", acciones: [vender], motivo: "x" } }))).toMatchObject({
      tipo: "caja",
      acciones: [{ tipo: "agregar" }],
    });
    expect(planDe(propuesta({ intencion: "agente", agente: { texto: "No tienes Cerveza Paceña.", acciones: [crear], motivo: "x" } }))).toEqual({
      tipo: "asistente",
      texto: "No tienes Cerveza Paceña.",
    });
  });
});
