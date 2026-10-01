import { expect, test } from "@playwright/test";

import type { ProductoOpcion } from "../../src/entities/omnibox/model/types";
import { crearCoreografia, efectosDeCambio, type Efecto } from "../../src/features/omnibox/model/coreografia";
import { MESA_INICIAL, mesaReducer, type AccionMesa, type Mesa } from "../../src/features/omnibox/model/mesa";

/**
 * La coreografía (Fase G0): qué se tiene que ver con cada cambio de la mesa.
 * Sale de comparar la mesa antes y después, así que el botón y la frase
 * producen lo mismo; estas pruebas fijan ese contrato antes de dibujarlo (G1).
 */

const producto = (id: string, precio: number): ProductoOpcion => ({
  storeProductId: `sp-${id}`,
  productId: id,
  nombre: `Producto ${id}`,
  codigo: null,
  imagen: null,
  precio,
  stock: 50,
  similitud: 1,
});

const A = producto("a", 10);
const B = producto("b", 4);

const aplicar = (base: Mesa, ...acciones: AccionMesa[]): Mesa => acciones.reduce(mesaReducer, base);
const efectos = (base: Mesa, ...acciones: AccionMesa[]): Efecto[] => efectosDeCambio(base, aplicar(base, ...acciones));

test("agregar un producto nuevo: entra su línea y el total cambia", () => {
  expect(efectos(MESA_INICIAL, { tipo: "agregarVenta", producto: A, cantidad: 2 })).toEqual([
    { tipo: "lineaEntra", mesa: "venta", productId: "a" },
    { tipo: "total", mesa: "venta", de: 0, a: 20 },
  ]);
});

test("agregar uno que ya estaba: cambia la cantidad, no entra otra línea", () => {
  const base = aplicar(MESA_INICIAL, { tipo: "agregarVenta", producto: A });
  expect(efectos(base, { tipo: "agregarVenta", producto: A, cantidad: 2 })).toEqual([
    { tipo: "cantidad", mesa: "venta", productId: "a", de: 1, a: 3 },
    { tipo: "total", mesa: "venta", de: 10, a: 30 },
  ]);
});

test("quitar: sale la línea", () => {
  const base = aplicar(MESA_INICIAL, { tipo: "agregarVenta", producto: A }, { tipo: "agregarVenta", producto: B });
  expect(efectos(base, { tipo: "quitarVenta", productId: "b" })).toEqual([
    { tipo: "lineaSale", mesa: "venta", productId: "b" },
    { tipo: "total", mesa: "venta", de: 14, a: 10 },
  ]);
});

test("limpiar: un solo efecto de vaciado, no una salida por línea", () => {
  const base = aplicar(MESA_INICIAL, { tipo: "agregarVenta", producto: A }, { tipo: "agregarVenta", producto: B });
  expect(efectos(base, { tipo: "limpiarVenta" })).toEqual([
    { tipo: "vaciada", mesa: "venta" },
    { tipo: "total", mesa: "venta", de: 14, a: 0 },
  ]);
});

test("elegir cliente y pago: se marcan los campos completados", () => {
  const base = aplicar(MESA_INICIAL, { tipo: "agregarVenta", producto: A });
  expect(
    efectos(base, { tipo: "cliente", clienteId: "c1", nombre: "José" }, { tipo: "pago", pago: "qr" }),
  ).toEqual([
    { tipo: "campo", mesa: "venta", campo: "cliente" },
    { tipo: "campo", mesa: "venta", campo: "pago" },
  ]);
});

test("compra: corregir el costo marca ese campo y el total", () => {
  const base = aplicar(MESA_INICIAL, { tipo: "agregarCompra", producto: A, cantidad: 3, costo: 8, costoAnterior: null });
  expect(efectos(base, { tipo: "costoCompra", productId: "a", costo: 9 })).toEqual([
    { tipo: "campo", mesa: "compra", campo: "costo:a" },
    { tipo: "total", mesa: "compra", de: 24, a: 27 },
  ]);
});

test("cambiar de pestaña o abrir el panel no produce efectos de datos", () => {
  const base = aplicar(MESA_INICIAL, { tipo: "agregarVenta", producto: A });
  expect(efectos(base, { tipo: "abrir", mesa: "compra" }, { tipo: "pestana", pestana: "producto" })).toEqual([]);
});

test("el bus reparte a cada oyente y deja de avisar al que se desuscribe", () => {
  const bus = crearCoreografia();
  const recibidos: Efecto[][] = [];
  const salir = bus.suscribir((e) => recibidos.push(e));
  bus.emitir([{ tipo: "vaciada", mesa: "venta" }]);
  bus.emitir([]); // vacío: no molesta a nadie
  salir();
  bus.emitir([{ tipo: "vaciada", mesa: "compra" }]);
  expect(recibidos).toEqual([[{ tipo: "vaciada", mesa: "venta" }]]);
});
