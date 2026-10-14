import { expect, test } from "@playwright/test";

import { contestar, type MemoriaAlta } from "../../src/features/scanner/model/conversacion-alta";

/**
 * Lo que contesta el alta por voz: siempre contesta algo, confirma lo que
 * anotó, pide lo que falta y registra solo cuando la persona lo pide.
 */

const nada = { cambios: {}, soloCosto: false, afirma: false, niega: false, registrar: false, respuesta: null, dudas: [], yaEstaba: false };
const mem = (): MemoriaAlta => ({ preguntoCantidad: false });
const coca = { nombre: "Coca-Cola 2 l", precio: null, cantidad: 0 };
const completo = { nombre: "Coca-Cola 2 l", precio: 20, cantidad: 5 };

test("un «sí» a «¿Lo damos de alta?» pide precio y cantidad juntos", () => {
  const c = contestar({ ...nada, afirma: true }, coca, "stock", mem(), "alta");
  expect(c.texto).toBe("Perfecto. Dime el precio de venta y, si quieres, con cuántas unidades entra al stock.");
  expect(c.pregunta).toBe("precioYCantidad");
  expect(c.registrar).toBe(false);
});

test("precio y stock de una vez: confirma los dos y pregunta si registra", () => {
  const c = contestar({ ...nada, cambios: { precio: 20, cantidad: 5 } }, completo, "stock", mem(), "precioYCantidad");
  expect(c.texto).toMatch(/^Listo: precio Bs\s20,00 y 5 en stock\. ¿Lo registro\?/);
  expect(c.frases).toEqual([
    { tipo: "texto", texto: "Listo." },
    { tipo: "precio", monto: 20, moneda: "BOB" },
    { tipo: "texto", texto: "Cinco en stock." },
    { tipo: "texto", texto: "¿Lo registro?" },
  ]);
  expect(c.pregunta).toBe("registrar");
});

test("solo el precio: confirma y pregunta la cantidad una sola vez", () => {
  const m = mem();
  const c = contestar({ ...nada, cambios: { precio: 20 } }, { ...coca, precio: 20 }, "stock", m, "precio");
  expect(c.pregunta).toBe("cantidad");
  const otra = contestar({ ...nada, afirma: true }, { ...coca, precio: 20 }, "stock", m, "cantidad");
  expect(otra.pregunta).toBe("registrar");
});

test("«sí» a «¿Lo registro?» registra; un «sí» a otra cosa, no", () => {
  expect(contestar({ ...nada, afirma: true }, completo, "stock", mem(), "registrar").registrar).toBe(true);
  expect(contestar({ ...nada, afirma: true }, completo, "stock", mem(), "alta").registrar).toBe(false);
});

test("«regístralo» sin precio no registra: avisa qué falta", () => {
  const c = contestar({ ...nada, registrar: true }, coca, "stock", mem(), "registrar");
  expect(c.registrar).toBe(false);
  expect(c.texto).toMatch(/^Antes de registrarlo falta un dato\. Dime el precio/);
});

test("«no» a «¿Lo damos de alta?» termina; a «¿Lo registro?», pregunta qué cambiar", () => {
  expect(contestar({ ...nada, niega: true }, coca, "stock", mem(), "alta")).toMatchObject({ terminar: true, texto: "De acuerdo, no lo registro." });
  expect(contestar({ ...nada, niega: true }, completo, "stock", mem(), "registrar")).toMatchObject({
    terminar: false,
    texto: "De acuerdo. ¿Qué quieres cambiar?",
  });
});

test("un número que no se entendió: lo pide de nuevo", () => {
  const c = contestar({ ...nada, dudas: ["precio"] }, coca, "stock", mem(), "precio");
  expect(c.texto).toBe("No entendí bien el precio. ¿Me lo repites?");
  expect(c.pregunta).toBe("precio");
});

test("repetir lo que ya estaba: lo dice y sigue", () => {
  const c = contestar({ ...nada, yaEstaba: true }, completo, "stock", { preguntoCantidad: true }, "registrar");
  expect(c.texto).toMatch(/^Eso ya está anotado\. ¿Lo registro\?/);
});

test("nada entendible: pide repetir y mantiene la pregunta", () => {
  const c = contestar(nada, coca, "stock", mem(), "precio");
  expect(c).toMatchObject({ texto: "No te entendí bien. ¿Me lo repites?", pregunta: "precio", progreso: false });
});

test("contesta la duda y sigue con lo que falta", () => {
  const c = contestar({ ...nada, respuesta: "La categoría agrupa tus productos." }, coca, "stock", mem(), "alta");
  expect(c.texto).toMatch(/^La categoría agrupa tus productos\. Dime el precio de venta/);
});

test("nunca voseo", () => {
  const todo = [
    contestar({ ...nada, afirma: true }, coca, "stock", mem(), "alta").texto,
    contestar({ ...nada, niega: true }, completo, "stock", mem(), "registrar").texto,
    contestar(nada, coca, "stock", mem(), "precio").texto,
  ].join(" ");
  expect(todo).not.toMatch(/\b(decime|tenés|querés|podés|registralo|repetís)\b/i);
});
