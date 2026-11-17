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
    // Algo que el piloto todavía no hace en una pantalla (cambiar un producto).
    const crear = propuesta({ intencion: "editar_producto", entidades: { productId: "p-coca", cambios: { nombre: "Coca" } } });
    expect(planDe(propuesta({ intencion: "agente", agente: { texto: "Te lo agrego.", acciones: [vender], motivo: "x" } }))).toMatchObject({
      tipo: "caja",
      acciones: [{ tipo: "agregar" }],
    });
    expect(planDe(propuesta({ intencion: "agente", agente: { texto: "Te dejé el cambio.", acciones: [crear], motivo: "x" } }))).toEqual({
      tipo: "asistente",
      texto: "Te dejé el cambio.",
    });
  });
});

test.describe("Inventario, Pedidos y Productos", () => {
  test("stock de uno: antes y después de la vista previa", () => {
    const p = propuesta({
      intencion: "ajustar_stock",
      entidades: { productId: "p-coca", producto: "Coca Cola 2L", cantidad: 30 },
      vistaPrevia: { etiqueta: "Stock", antes: 36, despues: 30 },
      requiereConfirmacion: true,
    });
    expect(planDe(p)).toMatchObject({ tipo: "stock", filas: [{ productId: "p-coca", antes: 36, despues: 30 }] });
  });

  test("stock de varios: cada fila del lote", () => {
    const lote = [
      { productId: "p-coca", producto: "Coca Cola 2L", cantidad: 30, antes: 36 },
      { productId: "p-fanta", producto: "Fanta 2L", cantidad: 12, antes: 20 },
    ];
    const plan = planDe(propuesta({ intencion: "ajustar_stock", entidades: { lote }, requiereConfirmacion: true }));
    expect(plan).toMatchObject({ tipo: "stock", filas: [{ despues: 30 }, { despues: 12 }] });
    if (plan.tipo === "stock") expect(plan.entidades).toEqual({ lote });
  });

  test("stock dudoso: pregunta de cuál", () => {
    const p = propuesta({ intencion: "ajustar_stock", ejecutable: false, opciones: [coca, fanta], entidades: { cantidad: 30 } });
    expect(planDe(p)).toMatchObject({ tipo: "decir", texto: expect.stringContaining("¿De cuál?") });
  });

  test("mover un pedido; cancelarlo queda para tocar", () => {
    const mover = propuesta({ intencion: "estado_pedido", entidades: { orderId: "o1", numero: 1630, estado: "en-camino", antes: "completado", cliente: "jhoel" } });
    expect(planDe(mover)).toEqual({ tipo: "pedido", orderId: "o1", numero: 1630, cliente: "jhoel", antes: "completado", estado: "en-camino" });
    const cancelar = propuesta({ intencion: "estado_pedido", entidades: { orderId: "o1", numero: 1630, estado: "cancelado", antes: "pendiente" } });
    expect(planDe(cancelar).tipo).toBe("asistente");
  });

  test("un producto nuevo va al formulario; lo que no dijo queda vacío", () => {
    const crear = propuesta({ intencion: "crear_producto", entidades: { productos: [{ nombre: "Galletas Oreo", precio: 8, stock: null, categoria: { id: "c1", nombre: "Snacks" } }] } });
    expect(planDe(crear)).toEqual({
      tipo: "producto",
      borrador: { nombre: "Galletas Oreo", precio: 8, stock: null, categoria: { id: "c1", nombre: "Snacks" } },
    });
    const sinPrecio = propuesta({ intencion: "crear_producto", entidades: { productos: [{ nombre: "Galletas Oreo", precio: null }] } });
    expect(planDe(sinPrecio)).toMatchObject({ borrador: { precio: null } });
    // Varios a la vez: el formulario de varios está en el asistente.
    const varios = propuesta({ intencion: "crear_producto", entidades: { productos: [{ nombre: "A" }, { nombre: "B" }] } });
    expect(planDe(varios).tipo).not.toBe("producto");
  });

  test("del agente: el producto o el pedido que preparó", () => {
    const crear = propuesta({ intencion: "crear_producto", entidades: { productos: [{ nombre: "Galletas Oreo", precio: 8 }] } });
    expect(planDe(propuesta({ intencion: "agente", agente: { texto: "Te lo dejé.", acciones: [crear], motivo: "x" } })).tipo).toBe("producto");
  });

  test("respuestas con número: precio con decimales, cantidades en palabras y 'ninguna'", () => {
    expect(leerRespuesta("a 8,50", "precio")).toEqual({ tipo: "numero", valor: 8.5 });
    expect(leerRespuesta("12 bolivianos", "precio")).toEqual({ tipo: "numero", valor: 12 });
    expect(leerRespuesta("doce", "cantidad")).toEqual({ tipo: "numero", valor: 12 });
    expect(leerRespuesta("ninguna", "cantidad")).toEqual({ tipo: "numero", valor: 0 });
    expect(leerRespuesta("no tengo", "cantidad")).toEqual({ tipo: "numero", valor: 0 });
    // Sin pregunta de precio, un número suelto no es una respuesta.
    expect(leerRespuesta("8", "confirmar")).toBeNull();
  });
});
