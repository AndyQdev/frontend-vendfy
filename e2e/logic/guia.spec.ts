import { expect, test } from "@playwright/test";

import type { ProductoOpcion } from "../../src/entities/omnibox/model/types";
import {
  MENSAJES,
  UMBRAL_COSTO_SUBIO,
  errorDeCobro,
  errores,
  faltantesDelServidor,
  nuevasAdvertencias,
  principal,
  revisarCompra,
  revisarVenta,
  sigueVigente,
} from "../../src/features/omnibox/model/guia";
import { MESA_INICIAL, mesaReducer, type AccionMesa, type Mesa } from "../../src/features/omnibox/model/mesa";

/**
 * La Guía (Fase G0), sin navegador: qué dice, cuándo bloquea y cuándo calla.
 * Un mensaje que no aparece cuando debe es una venta mal cobrada; uno que
 * aparece cuando no debe es ruido que enseña a ignorarla.
 */

const producto = (id: string, precio: number, stock = 10, nombre = `Producto ${id}`): ProductoOpcion => ({
  storeProductId: `sp-${id}`,
  productId: id,
  nombre,
  codigo: null,
  imagen: null,
  precio,
  stock,
  similitud: 1,
});

const ACEITE = producto("aceite", 18, 17, "Aceite vegetal 1L");
const COCA = producto("coca", 12, 0, "Coca Cola 2L");

const aplicar = (...acciones: AccionMesa[]): Mesa => acciones.reduce(mesaReducer, MESA_INICIAL);

test.describe("revisar la venta", () => {
  test("la venta nueva arranca sin método de pago", () => {
    expect(MESA_INICIAL.venta.pago).toBeNull();
  });

  test("vacía: un solo error, sin hablar de pago ni stock", () => {
    const ms = revisarVenta(MESA_INICIAL.venta);
    expect(ms.map((m) => m.codigo)).toEqual(["VENTA_VACIA"]);
    expect(ms[0].nivel).toBe("error");
  });

  test("sin método de pago: error que señala el campo y ofrece los cuatro métodos", () => {
    const m = aplicar({ tipo: "agregarVenta", producto: ACEITE });
    const falta = errores(revisarVenta(m.venta))[0];
    expect(falta.codigo).toBe("FALTA_PAGO");
    expect(falta.campo).toBe("pago");
    expect(falta.acciones.map((a) => (a.tipo === "pago" ? a.pago : a.tipo))).toEqual(["efectivo", "qr", "tarjeta", "dolares"]);
  });

  test('"cobrale con QR": el método dicho en la frase cuenta aunque no esté en el borrador', () => {
    const m = aplicar({ tipo: "agregarVenta", producto: ACEITE });
    expect(errores(revisarVenta(m.venta, "qr"))).toEqual([]);
  });

  test("sin stock: advertencia (no bloquea, D3) que señala la cantidad de ESA línea", () => {
    const m = aplicar({ tipo: "agregarVenta", producto: COCA, cantidad: 3 }, { tipo: "pago", pago: "efectivo" });
    const ms = revisarVenta(m.venta);
    expect(errores(ms)).toEqual([]);
    expect(ms[0]).toMatchObject({ codigo: "SIN_STOCK", nivel: "advertencia", campo: "cantidad:coca" });
    expect(ms[0].texto).toContain("No tenés stock de Coca Cola 2L");
  });

  test("con stock de sobra: no dice nada", () => {
    const m = aplicar({ tipo: "agregarVenta", producto: ACEITE, cantidad: 2 }, { tipo: "pago", pago: "qr" });
    expect(revisarVenta(m.venta)).toEqual([]);
  });

  test("principal: un error gana siempre a una advertencia", () => {
    const m = aplicar({ tipo: "agregarVenta", producto: COCA });
    expect(principal(revisarVenta(m.venta))?.codigo).toBe("FALTA_PAGO");
  });
});

test.describe("revisar la compra", () => {
  const compra = (costo: number, costoAnterior: number | null) =>
    aplicar({ tipo: "agregarCompra", producto: ACEITE, cantidad: 5, costo, costoAnterior }).compra;

  test("vacía: error", () => {
    expect(revisarCompra(MESA_INICIAL.compra).map((m) => m.codigo)).toEqual(["COMPRA_VACIA"]);
  });

  test("sin costo: advertencia en el costo de esa línea", () => {
    expect(revisarCompra(compra(0, null))[0]).toMatchObject({ codigo: "COSTO_CERO", campo: "costo:aceite" });
  });

  test(`el costo subió ${UMBRAL_COSTO_SUBIO * 100} % o más: avisa con el porcentaje`, () => {
    const m = revisarCompra(compra(15, 12))[0];
    expect(m.codigo).toBe("COSTO_SUBIO");
    expect(m.texto).toContain("25 % más caro");
  });

  test("subió poco (ruido): no avisa", () => {
    expect(revisarCompra(compra(12.5, 12))).toEqual([]);
  });

  test("renglones de la factura sin resolver: error que señala el primero", () => {
    const m = aplicar(
      { tipo: "agregarCompra", producto: ACEITE, cantidad: 5, costo: 15, costoAnterior: null },
      { tipo: "factura", adjunto: null, porResolver: ["m1:2", "m1:4"] },
    );
    const e = errores(revisarCompra(m.compra))[0];
    expect(e).toMatchObject({ codigo: "RENGLON_SIN_RESOLVER", campo: "renglon:m1:2" });
    expect(e.texto).toContain("Faltan 2 renglones");
  });

  test("solo renglones sin resolver (nada reconocido): pide resolverlos, no dice 'vacía'", () => {
    const m = aplicar({ tipo: "factura", adjunto: null, porResolver: ["m1:0"] });
    expect(revisarCompra(m.compra).map((x) => x.codigo)).toEqual(["RENGLON_SIN_RESOLVER"]);
  });
});

test.describe("cuándo habla y cuándo calla", () => {
  test("anuncia solo las advertencias NUEVAS de un cambio", () => {
    const antes = aplicar({ tipo: "agregarVenta", producto: COCA, cantidad: 2 });
    const despues = mesaReducer(antes, { tipo: "agregarVenta", producto: producto("x", 5, 0, "Galletas") });
    const nuevas = nuevasAdvertencias(revisarVenta(antes.venta), revisarVenta(despues.venta));
    expect(nuevas.map((m) => m.clave)).toEqual(["SIN_STOCK:x"]);
  });

  test("FALTA_PAGO deja de valer apenas se elige el método", () => {
    const m = aplicar({ tipo: "agregarVenta", producto: ACEITE });
    const falta = MENSAJES.faltaPago();
    expect(sigueVigente(falta, m.venta, m.compra)).toBe(true);
    const pagado = mesaReducer(m, { tipo: "pago", pago: "tarjeta" });
    expect(sigueVigente(falta, pagado.venta, pagado.compra)).toBe(false);
  });

  test("el error de stock del servidor vale hasta que se cambia ESA cantidad", () => {
    const m = aplicar({ tipo: "agregarVenta", producto: ACEITE, cantidad: 999 }, { tipo: "pago", pago: "qr" });
    const e = errorDeCobro("No hay stock suficiente de: Aceite vegetal 1L (hay 17, se piden 999). Si es…", m.venta);
    expect(sigueVigente(e, m.venta, m.compra)).toBe(true);
    // Otro cambio (el cliente) no lo apaga…
    const conCliente = mesaReducer(m, { tipo: "cliente", clienteId: "c1", nombre: "José" });
    expect(sigueVigente(e, conCliente.venta, conCliente.compra)).toBe(true);
    // …bajar la cantidad sí.
    const menos = mesaReducer(m, { tipo: "cantidadVenta", productId: "aceite", cantidad: 5 });
    expect(sigueVigente(e, menos.venta, menos.compra)).toBe(false);
  });
});

test.describe("errores del servidor", () => {
  test("formato de OrderService, con varios productos", () => {
    const t =
      "No hay stock suficiente de: Aceite vegetal 1L (hay 17, se piden 999); Coca Cola 2L (hay 0, se piden 3). " +
      'Si es un producto que consigues a pedido, habilita "A pedido" para poder venderlo sin stock.';
    expect(faltantesDelServidor(t)).toEqual([
      { nombre: "Aceite vegetal 1L", hay: 17 },
      { nombre: "Coca Cola 2L", hay: 0 },
    ]);
  });

  test("formato del trigger de la base (con unidades y comillas)", () => {
    const t = 'Stock insuficiente de "Grace Lumière": hay 0, se intento descontar 100. Revisa la disponibilidad.';
    expect(faltantesDelServidor(t)).toEqual([{ nombre: "Grace Lumière", hay: 0 }]);
  });

  test("si nombra un producto del carrito, señala su cantidad (aunque cambien tildes y mayúsculas)", () => {
    const m = aplicar({ tipo: "agregarVenta", producto: producto("g", 300, 0, "Grace Lumière") });
    const e = errorDeCobro('Stock insuficiente de "GRACE LUMIERE": hay 0, se intento descontar 1.', m.venta);
    expect(e).toMatchObject({ codigo: "SIN_STOCK", nivel: "error", campo: "cantidad:g" });
  });

  test("si no nombra nada conocido, se dice tal cual, sin campo", () => {
    const e = errorDeCobro("Tu usuario no tiene permiso para vender.", MESA_INICIAL.venta);
    expect(e).toMatchObject({ codigo: "SERVIDOR", texto: "Tu usuario no tiene permiso para vender." });
    expect(e.campo).toBeUndefined();
  });
});
