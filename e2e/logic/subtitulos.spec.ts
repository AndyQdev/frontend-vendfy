import { expect, test } from "@playwright/test";

import { aprenderRitmo, palabrasVisibles, pesarTexto, ritmoDeVoz } from "../../src/features/piloto/lib/subtitulos";

/**
 * Subtítulos de Vendfy al ritmo de la voz: el tiempo de lo dicho se reparte
 * entre las palabras según lo que pesan al decirse (letras, números que se
 * dicen en letras, pausas de comas y puntos).
 */

test("sin voz sonada no hay palabras; con toda, están todas", () => {
  const t = pesarTexto("Listo, agregué 2 Sprite a la venta. ¿Algo más?");
  expect(palabrasVisibles(t, 0)).toBe(0);
  expect(palabrasVisibles(t, 1)).toBe(t.palabras.length);
  expect(palabrasVisibles(t, 1.4)).toBe(t.palabras.length);
});

test("las palabras salen de a poco y nunca retroceden al avanzar", () => {
  const t = pesarTexto("Puedo ayudarte a gestionar toda tu tienda: buscar, crear y actualizar productos, controlar tu stock y armar ventas.");
  let antes = 0;
  const vistos: number[] = [];
  for (let f = 0; f <= 1.0001; f += 0.05) {
    const n = palabrasVisibles(t, f);
    expect(n).toBeGreaterThanOrEqual(antes);
    antes = n;
    vistos.push(n);
  }
  // A mitad de camino se ve más o menos la mitad, no todo ni nada.
  const mitad = palabrasVisibles(t, 0.5);
  expect(mitad).toBeGreaterThan(t.palabras.length * 0.3);
  expect(mitad).toBeLessThan(t.palabras.length * 0.75);
  expect(new Set(vistos).size).toBeGreaterThan(8);
});

test("un número pesa más que sus cifras (27 se dice «veintisiete»)", () => {
  const t = pesarTexto("Son 27 bolivianos");
  const [son, numero, bolivianos] = t.palabras;
  expect(numero.desde - son.desde).toBeLessThan(bolivianos.desde - numero.desde);
});

test("después de un punto la siguiente palabra espera la pausa", () => {
  const conPunto = pesarTexto("Listo. Sigue");
  const sinPunto = pesarTexto("Listo Sigue");
  expect(conPunto.palabras[1].desde).toBeGreaterThan(sinPunto.palabras[1].desde);
  const conComa = pesarTexto("Listo, sigue");
  expect(conComa.palabras[1].desde).toBeGreaterThan(sinPunto.palabras[1].desde);
  expect(conComa.palabras[1].desde).toBeLessThan(conPunto.palabras[1].desde);
});

test("la palabra aparece cuando empieza a sonar, apenas adelantada", () => {
  const t = pesarTexto("uno dos tres cuatro");
  // Justo al empezar la segunda palabra ya se ve.
  const f = t.palabras[1].desde / t.total;
  expect(palabrasVisibles(t, f)).toBe(2);
  // Mucho antes, no.
  expect(palabrasVisibles(t, f / 4)).toBe(1);
});

test("el ritmo aprendido se mueve hacia lo medido e ignora lo absurdo", () => {
  const antes = ritmoDeVoz();
  aprenderRitmo(200, 10); // 20 por segundo
  const despues = ritmoDeVoz();
  expect(Math.abs(despues - 20)).toBeLessThan(Math.abs(antes - 20));
  aprenderRitmo(200, 0.1); // frase cortada: no se aprende
  aprenderRitmo(5, 3); // muy corta: no se aprende
  expect(ritmoDeVoz()).toBe(despues);
});
