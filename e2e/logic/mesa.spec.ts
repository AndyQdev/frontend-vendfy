import { expect, test } from "@playwright/test";

import type { ProductoOpcion } from "../../src/entities/omnibox/model/types";
import {
  MESA_INICIAL,
  efectoDeVenta,
  facturaDe,
  enCurso,
  marcarAplicados,
  faltantes,
  mesaReducer,
  totalVenta,
  totalCompra,
  costoSugerido,
  unidades,
  type AccionMesa,
  type Mesa,
  faltaParaCobrar,
  totalConEnvio,
} from "../../src/features/omnibox/model/mesa";

/**
 * La mesa de trabajo, sin navegador.
 *
 * Es la pieza que más se va a tocar (el panel y el chat la modifican) y la que
 * más fácil se rompe en silencio: un carrito que pierde una línea no tira
 * ningún error, solo cobra de menos.
 */

const producto = (id: string, precio: number, stock = 10): ProductoOpcion => ({
  storeProductId: `sp-${id}`,
  productId: id,
  nombre: `Producto ${id}`,
  codigo: null,
  imagen: null,
  precio,
  stock,
  similitud: 1,
});

const GOLD = producto("gold", 250, 100);
const ABSOLUT = producto("absolut", 270, 32);

const aplicar = (...acciones: AccionMesa[]): Mesa => acciones.reduce(mesaReducer, MESA_INICIAL);

test.describe("abrir y cerrar", () => {
  test("ver un producto sin mesa abierta abre la venta en la pestaña Producto", () => {
    const m = aplicar({ tipo: "verProducto", producto: GOLD });
    expect(m.abierta).toBe("venta");
    expect(m.pestana).toBe("producto");
    expect(m.producto?.productId).toBe("gold");
  });

  test("ver un producto con la compra abierta lo muestra en la compra", () => {
    const m = aplicar({ tipo: "abrir", mesa: "compra" }, { tipo: "verProducto", producto: GOLD });
    expect(m.abierta).toBe("compra");
  });

  test("cerrar NO borra lo armado", () => {
    const m = aplicar({ tipo: "agregarVenta", producto: GOLD }, { tipo: "cerrar" });
    expect(m.abierta).toBeNull();
    expect(m.venta.lineas).toHaveLength(1);
  });

  test("cambiar a la compra conserva la venta, y volver la muestra", () => {
    const m = aplicar(
      { tipo: "agregarVenta", producto: GOLD },
      { tipo: "abrir", mesa: "compra" },
    );
    expect(m.abierta).toBe("compra");
    expect(enCurso(m)).toEqual([{ tipo: "venta", lineas: 1 }]);

    const vuelta = mesaReducer(m, { tipo: "abrir", mesa: "venta" });
    // Con algo armado, abrir la venta muestra el carrito, no una ficha vacía.
    expect(vuelta.pestana).toBe("borrador");
    expect(vuelta.venta.lineas).toHaveLength(1);
  });

  test("cerrar desamplía: la próxima vez que se abra, se ve el chat", () => {
    const m = aplicar({ tipo: "verProducto", producto: GOLD }, { tipo: "ampliar" }, { tipo: "cerrar" });
    expect(m.ampliada).toBe(false);
  });
});

test.describe("el carrito", () => {
  test("agregar lo mismo dos veces suma, no duplica la línea", () => {
    const m = aplicar(
      { tipo: "agregarVenta", producto: GOLD },
      { tipo: "agregarVenta", producto: GOLD, cantidad: 2 },
    );
    expect(m.venta.lineas).toHaveLength(1);
    expect(m.venta.lineas[0].cantidad).toBe(3);
  });

  test("el total es el del diseño: 1 Gold + 2 Absolut = Bs 790", () => {
    const m = aplicar(
      { tipo: "agregarVenta", producto: GOLD },
      { tipo: "agregarVenta", producto: ABSOLUT, cantidad: 2 },
    );
    expect(totalVenta(m.venta)).toBe(790);
    expect(unidades(m.venta.lineas)).toBe(3);
  });

  test("bajar la cantidad a 0 quita la línea", () => {
    const m = aplicar(
      { tipo: "agregarVenta", producto: GOLD },
      { tipo: "cantidadVenta", productId: "gold", cantidad: 0 },
    );
    expect(m.venta.lineas).toHaveLength(0);
  });

  test("un precio negativo se ignora", () => {
    const m = aplicar(
      { tipo: "agregarVenta", producto: GOLD },
      { tipo: "precioVenta", productId: "gold", precio: -5 },
    );
    expect(m.venta.lineas[0].precio).toBe(250);
  });

  test("el total se redondea al final: 3 × 3,33 = 9,99", () => {
    const m = aplicar({ tipo: "agregarVenta", producto: producto("x", 3.33), cantidad: 3 });
    expect(totalVenta(m.venta)).toBe(9.99);
  });

  test("avisa las líneas que piden más de lo que hay", () => {
    const m = aplicar({ tipo: "agregarVenta", producto: ABSOLUT, cantidad: 40 });
    expect(faltantes(m.venta).map((l) => l.productId)).toEqual(["absolut"]);
  });

  test("agregar no abre el panel solo: lo decide la pantalla", () => {
    expect(aplicar({ tipo: "agregarVenta", producto: GOLD }).abierta).toBeNull();
  });

  test("limpiar vacía el carrito pero deja la mesa abierta", () => {
    const m = aplicar({ tipo: "abrir", mesa: "venta" }, { tipo: "agregarVenta", producto: GOLD }, { tipo: "limpiarVenta" });
    expect(m.venta.lineas).toHaveLength(0);
    expect(m.abierta).toBe("venta");
    expect(m.venta.clienteNombre).toBe("Consumidor final");
  });
});

test.describe("frases → acciones (Fase 3)", () => {
  const propuesta = (intencion: string, entidades: Record<string, unknown>, producto: ProductoOpcion | null = null) => ({
    intencion,
    ejecutable: true,
    entidades,
    producto,
  });

  test('"sumá 2 absolut" termina en el mismo agregarVenta que el botón', () => {
    const ef = efectoDeVenta(propuesta("agregar_a_venta", { cantidad: 2 }, ABSOLUT))!;
    const porFrase = ef.acciones.reduce(mesaReducer, MESA_INICIAL);
    const porBoton = mesaReducer(MESA_INICIAL, { tipo: "agregarVenta", producto: ABSOLUT, cantidad: 2 });
    expect(porFrase.venta).toEqual(porBoton.venta);
    expect(ef.resumen).toContain("2 × Producto absolut");
    expect(ef.resumen).toContain("540,00");
  });

  test('"a 240 el gold" cambia el precio de esa venta', () => {
    const ef = efectoDeVenta(propuesta("agregar_a_venta", { cantidad: 1, precio: 240 }, GOLD))!;
    const m = ef.acciones.reduce(mesaReducer, MESA_INICIAL);
    expect(m.venta.lineas[0].precio).toBe(240);
  });

  test('"que sean 0" saca la línea', () => {
    const conGold = mesaReducer(MESA_INICIAL, { tipo: "agregarVenta", producto: GOLD });
    const ef = efectoDeVenta(propuesta("cambiar_cantidad_venta", { productId: "gold", producto: "Gold", cantidad: 0 }))!;
    expect(ef.acciones.reduce(mesaReducer, conGold).venta.lineas).toHaveLength(0);
    expect(ef.resumen).toContain("Saqué");
  });

  test('"cobrale con QR" pone el pago Y pide cobrar', () => {
    const ef = efectoDeVenta(propuesta("cobrar", { pago: "qr" }))!;
    expect(ef.cobrar).toBe(true);
    expect(ef.acciones.reduce(mesaReducer, MESA_INICIAL).venta.pago).toBe("qr");
  });

  test("si no alcanza para actuar (dos José, sin producto), no inventa: null", () => {
    expect(efectoDeVenta(propuesta("elegir_cliente", { nombre: "jose" }))).toBeNull();
    expect(efectoDeVenta(propuesta("agregar_a_venta", { cantidad: 2 }))).toBeNull();
    expect(efectoDeVenta({ ...propuesta("elegir_pago", { pago: "qr" }), ejecutable: false })).toBeNull();
  });
});

test.describe("pedidos de varias cosas", () => {
  const pedido = {
    intencion: "agregar_a_venta",
    ejecutable: true,
    producto: null,
    entidades: { nombre: "joel rodas", clienteId: "c1", cliente: "Joel Rodas" },
    items: [
      { texto: "un absolut", buscado: "absolut", cantidad: 1, precio: null, producto: ABSOLUT, opciones: [], noEncontrado: null },
      { texto: "un empire", buscado: "empire", cantidad: 2, precio: null, producto: null, opciones: [GOLD, ABSOLUT], noEncontrado: null },
    ],
  };

  test("agrega lo claro y pone el cliente; lo dudoso queda para elegir", () => {
    const ef = efectoDeVenta(pedido)!;
    const m = ef.acciones.reduce(mesaReducer, MESA_INICIAL);
    expect(m.venta.lineas.map((l) => l.productId)).toEqual(["absolut"]);
    expect(m.venta.clienteNombre).toBe("Joel Rodas");
    expect(ef.resumen).toBe("Agregado a la venta · 1 × Producto absolut, para Joel Rodas");
  });

  test("volver a aplicar (al elegir el cliente) no agrega dos veces lo mismo", () => {
    const aplicado = marcarAplicados(pedido);
    expect(efectoDeVenta(aplicado)).toBeNull();
  });
});

test.describe("la compra (Fase 4)", () => {
  test("vender y comprar a la vez: cambiar de mesa conserva las dos", () => {
    const m = aplicar(
      { tipo: "agregarVenta", producto: GOLD },
      { tipo: "abrir", mesa: "compra" },
      { tipo: "agregarCompra", producto: ABSOLUT, cantidad: 10, costo: 200, costoAnterior: 190 },
    );
    expect(m.venta.lineas).toHaveLength(1);
    expect(m.compra.lineas).toHaveLength(1);
    expect(enCurso(m)).toEqual([{ tipo: "venta", lineas: 1 }]);
    expect(totalCompra(m.compra)).toBe(2000);
  });

  test('"compré 10 absolut" sin costo precarga el último que se pagó', () => {
    const ef = efectoDeVenta({
      intencion: "agregar_a_compra",
      ejecutable: true,
      entidades: {},
      producto: null,
      items: [{ texto: "10 absolut", buscado: "absolut", cantidad: 10, precio: null, producto: ABSOLUT, opciones: [], noEncontrado: null }],
      costos: { absolut: { productId: "absolut", ultimoCosto: 190, ultimoProveedor: "Andina", costoPromedio: 185 } },
    })!;
    const m = ef.acciones.reduce(mesaReducer, MESA_INICIAL);
    expect(m.compra.lineas[0]).toMatchObject({ cantidad: 10, costo: 190, costoAnterior: 190 });
    expect(m.ultima).toBe("compra");
  });

  test('"a 200" gana sobre el último costo, y el anterior queda para comparar', () => {
    expect(costoSugerido(200, { productId: "x", ultimoCosto: 190, ultimoProveedor: null, costoPromedio: 185 })).toBe(200);
    expect(costoSugerido(null, { productId: "x", ultimoCosto: null, ultimoProveedor: null, costoPromedio: 185 })).toBe(185);
    expect(costoSugerido(null, null)).toBe(0);
  });

  test('"sacá" con la compra abierta saca de la compra, no de la venta', () => {
    const m = aplicar(
      { tipo: "agregarVenta", producto: GOLD },
      { tipo: "agregarCompra", producto: GOLD, cantidad: 5, costo: 180, costoAnterior: null },
    );
    const ef = efectoDeVenta({
      intencion: "quitar_de_venta",
      ejecutable: true,
      entidades: { productId: "gold", producto: "Gold", mesa: "compra" },
      producto: null,
    })!;
    const r = ef.acciones.reduce(mesaReducer, m);
    expect(r.compra.lineas).toHaveLength(0);
    expect(r.venta.lineas).toHaveLength(1);
  });
});

test.describe("la compra desde una foto (Fase 5)", () => {
  const factura = {
    intencion: "agregar_a_compra",
    ejecutable: true,
    producto: null,
    entidades: { factura: true, proveedor: "Distribuidora Andina", referencia: "004512", adjunto: "https://x/f.jpg" },
    items: [
      { texto: "ABSOLUT 750", buscado: "Absolut", cantidad: 6, precio: 200, producto: ABSOLUT, opciones: [], noEncontrado: null },
      { texto: "EMPIRE", buscado: "empire", cantidad: 2, precio: 180, producto: null, opciones: [GOLD], noEncontrado: null },
      { texto: "GALLETAS MARIA", buscado: "galletas maria", cantidad: 10, precio: 4.5, producto: null, opciones: [], noEncontrado: "GALLETAS MARIA" },
    ],
  };

  test("lo reconocido se carga con el costo de la factura; lo demás queda por resolver", () => {
    const m = [facturaDe("m1", factura)!, ...efectoDeVenta(factura)!.acciones].reduce(mesaReducer, MESA_INICIAL);
    expect(m.compra.lineas).toHaveLength(1);
    expect(m.compra.lineas[0]).toMatchObject({ productId: "absolut", cantidad: 6, costo: 200 });
    expect(m.compra.proveedor).toBe("Distribuidora Andina");
    expect(m.compra.referencia).toBe("004512");
    expect(m.compra.adjunto).toBe("https://x/f.jpg");
    expect(m.compra.porResolver).toEqual(["m1:1", "m1:2"]);
  });

  test("resolver (elegir, crear o descartar) saca el renglón de los pendientes", () => {
    const m = aplicar(facturaDe("m1", factura)!, { tipo: "lineaResuelta", clave: "m1:1" }, { tipo: "lineaResuelta", clave: "m1:2" });
    expect(m.compra.porResolver).toEqual([]);
  });

  test("un proveedor escrito a mano no se pisa si la factura no trae uno", () => {
    const sinProveedor = { ...factura, entidades: { ...factura.entidades, proveedor: null } };
    const m = aplicar({ tipo: "proveedor", proveedor: "Don Pepe" }, facturaDe("m1", sinProveedor)!);
    expect(m.compra.proveedor).toBe("Don Pepe");
  });

  test("limpiar la compra borra la foto y los pendientes", () => {
    const m = aplicar(facturaDe("m1", factura)!, { tipo: "limpiarCompra" });
    expect(m.compra.adjunto).toBeNull();
    expect(m.compra.porResolver).toEqual([]);
  });

  test("una frase que no es una factura no arma nada de factura", () => {
    expect(facturaDe("m1", { entidades: {}, items: [] })).toBeNull();
  });
});

test.describe("vender con delivery o a cuotas (G9f)", () => {
  const conCoca = () => mesaReducer(MESA_INICIAL, { tipo: "agregarVenta", producto: producto("coca", 12), cantidad: 2 });

  test("con delivery: la dirección, el envío suma al total, y hace falta el cliente", () => {
    let m = mesaReducer(conCoca(), { tipo: "tipoVenta", tipoVenta: "delivery" });
    expect(faltaParaCobrar(m.venta)).toEqual(["la dirección de entrega", "el cliente (para avisarle del envío)"]);
    m = mesaReducer(m, { tipo: "entrega", entrega: { direccion: "Av. Banzer 123", costo: 10 } });
    m = mesaReducer(m, { tipo: "cliente", clienteId: "c1", nombre: "Marta" });
    expect(faltaParaCobrar(m.venta)).toEqual([]);
    expect(totalConEnvio(m.venta)).toBe(34);
  });

  test("a cuotas: el cliente, cuánto paga hoy (sin pasarse del total) y la fecha", () => {
    let m = mesaReducer(conCoca(), { tipo: "cuotas", cuotas: { cantidad: 3 } });
    expect(m.venta.entrega).toBeNull();
    expect(faltaParaCobrar(m.venta)).toEqual(["el cliente (a cuotas necesita uno)", "cuánto paga hoy", "la fecha del próximo pago"]);
    m = mesaReducer(m, { tipo: "cliente", clienteId: "c1", nombre: "Marta" });
    m = mesaReducer(m, { tipo: "cuotas", cuotas: { inicial: 99, proxima: "2026-10-20" } });
    expect(faltaParaCobrar(m.venta)).toEqual(["un pago de hoy que no supere el total"]);
    m = mesaReducer(m, { tipo: "cuotas", cuotas: { inicial: 10 } });
    expect(faltaParaCobrar(m.venta)).toEqual([]);
  });

  test("volver a «en el momento» saca el delivery y las cuotas; limpiar también", () => {
    let m = mesaReducer(conCoca(), { tipo: "entrega", entrega: { direccion: "x" } });
    m = mesaReducer(m, { tipo: "tipoVenta", tipoVenta: "rapida" });
    expect(m.venta.entrega).toBeNull();
    expect(m.venta.cuotas).toBeNull();
    m = mesaReducer(mesaReducer(m, { tipo: "cuotas", cuotas: { cantidad: 2 } }), { tipo: "limpiarVenta" });
    expect(m.venta.cuotas).toBeNull();
  });

  test("lo que trae el agente: «es con delivery a…» sobre la venta abierta", () => {
    const efecto = efectoDeVenta({
      intencion: "agregar_a_venta",
      ejecutable: true,
      producto: null,
      items: [],
      entidades: { entrega: { direccion: "Av. Banzer 123", costo: 10 } },
    });
    expect(efecto?.acciones).toEqual([{ tipo: "entrega", entrega: { direccion: "Av. Banzer 123", costo: 10, notas: "" } }]);
    expect(efecto?.resumen).toBe("La venta · con delivery a Av. Banzer 123");
  });
});

