import { expect, test } from "@playwright/test";

import { MENSAJES, type MensajeGuia } from "../../src/features/omnibox/model/guia";
import { MEMORIA_VACIA, descartar, pideRevision } from "../../src/features/omnibox/model/memoria-guia";
import { numeroDicho, respuestaAGuia, resumenRespuesta } from "../../src/features/omnibox/model/respuesta-guia";
import { fraseDeGuia, paraHablar, seContestaHablando } from "../../src/features/omnibox/model/voz";

/**
 * G2b sin navegador: contestarle a la Guía ("6", "con QR", "sí", "no") y lo
 * que la Guía dice en voz alta cuando se le está hablando.
 */

const coca = { productId: "coca", nombre: "Coca Cola 2L" };
const cuantas = MENSAJES.cantidadNoDicha(coca, "venta");
const faltaPago = MENSAJES.faltaPago();

/** Como llegan del servidor (G2a): "¿Seguro 100?" con su "Sí, son 100". */
const inusual: MensajeGuia = {
  codigo: "CANTIDAD_INUSUAL",
  nivel: "sugerencia",
  mesa: "venta",
  texto: "¿Seguro 100 de Coca Cola 2L? Normalmente se venden 3.",
  acciones: [
    { tipo: "cantidad", mesa: "venta", productId: "coca", cantidad: 3, etiqueta: "Dejar en 3" },
    { tipo: "descartar", etiqueta: "Sí, son 100" },
  ],
  clave: "CANTIDAD_INUSUAL:coca:100",
  confianza: 0.9,
};
const quedaPoco: MensajeGuia = {
  codigo: "QUEDA_POCO",
  nivel: "sugerencia",
  mesa: "venta",
  texto: "Después de esta venta te quedan 2 de Coca Cola 2L.",
  acciones: [
    { tipo: "ver", campo: "x", etiqueta: "Anotar para comprar" },
    { tipo: "descartar", etiqueta: "Ahora no" },
  ],
  clave: "QUEDA_POCO:coca",
  confianza: 0.8,
};

test.describe("contestarle a la Guía", () => {
  test('"¿cuántas?": un número es la cantidad, aunque no sea uno de los botones', () => {
    expect(respuestaAGuia("6", cuantas)).toMatchObject({ tipo: "cantidad", productId: "coca", cantidad: 6 });
    expect(respuestaAGuia("que sean ocho", cuantas)).toMatchObject({ cantidad: 8 });
    expect(respuestaAGuia("media docena", cuantas)).toMatchObject({ cantidad: 6 });
    expect(respuestaAGuia("una docena", cuantas)).toMatchObject({ cantidad: 12 });
  });

  test('"es uno" cuando ya se puso 1: queda así', () => {
    expect(respuestaAGuia("es uno", cuantas)?.tipo).toBe("descartar");
  });

  test('"¿con qué paga?": efectivo, QR o tarjeta, dicho de varias formas', () => {
    expect(respuestaAGuia("con QR", faltaPago)).toMatchObject({ tipo: "pago", pago: "qr" });
    expect(respuestaAGuia("en efectivo", faltaPago)).toMatchObject({ pago: "efectivo" });
    expect(respuestaAGuia("tarjeta de débito", faltaPago)).toMatchObject({ pago: "tarjeta" });
    expect(respuestaAGuia("en dólares", faltaPago)).toMatchObject({ pago: "dolares" });
    // Con delivery o a cuotas no se ofrecen dólares: "en dólares" no contesta.
    expect(respuestaAGuia("en dólares", MENSAJES.faltaPago(false))).toBeNull();
    // "sí" no es un método de pago: no se adivina.
    expect(respuestaAGuia("sí", faltaPago)).toBeNull();
  });

  test('"¿Seguro 100?": el "sí" es dejarlo (la etiqueta lo dice), el "no" es la cantidad de siempre', () => {
    expect(respuestaAGuia("sí", inusual)).toMatchObject({ tipo: "descartar", etiqueta: "Sí, son 100" });
    expect(respuestaAGuia("no", inusual)).toMatchObject({ tipo: "cantidad", cantidad: 3 });
    // "No, que sean 5": el número manda.
    expect(respuestaAGuia("no, que sean 5", inusual)).toMatchObject({ tipo: "cantidad", cantidad: 5 });
  });

  test('una sugerencia con un solo botón: "sí" lo toca, "no, gracias" la descarta', () => {
    expect(respuestaAGuia("dale", quedaPoco)?.etiqueta).toBe("Anotar para comprar");
    expect(respuestaAGuia("no gracias", quedaPoco)?.tipo).toBe("descartar");
  });

  test('"la coca me salió a 10" habla del costo, no contesta "¿cuántas?" (la frase trae otras palabras)', () => {
    const compraCorta: MensajeGuia = {
      codigo: "COMPRA_CORTA",
      nivel: "sugerencia",
      mesa: "compra",
      texto: "La última vez compraste 24 de Coca Cola 2L; con 3 te alcanza para ~1 día.",
      acciones: [
        { tipo: "cantidad", mesa: "compra", productId: "coca", cantidad: 24, etiqueta: "Hacer 24" },
        { tipo: "descartar", etiqueta: "Dejar 3" },
      ],
      clave: "COMPRA_CORTA:coca",
      confianza: 0.7,
    };
    expect(respuestaAGuia("la coca me salió a 10", compraCorta)).toBeNull();
    expect(respuestaAGuia("es de Distribuidora Andina", compraCorta)).toBeNull();
    expect(respuestaAGuia("no, la coca era a 10", compraCorta)).toBeNull();
    // Lo que sí es una respuesta, sigue siéndolo.
    expect(respuestaAGuia("hacé 24", compraCorta)).toMatchObject({ cantidad: 24 });
    expect(respuestaAGuia("no, dejalo así", compraCorta)?.tipo).toBe("descartar");
  });

  test("una frase larga no es una respuesta: es otra venta y va al servidor", () => {
    expect(respuestaAGuia("vendé dos cocas y un aceite con QR", faltaPago)).toBeNull();
    expect(respuestaAGuia("6", null)).toBeNull();
  });

  test("lo que queda en el chat", () => {
    expect(resumenRespuesta({ tipo: "pago", pago: "qr", etiqueta: "QR" })).toBe("Paga con QR");
    expect(resumenRespuesta({ tipo: "cantidad", mesa: "venta", productId: "x", cantidad: 6, etiqueta: "6" })).toBe("Ahora son 6");
  });

  test("números dichos", () => {
    expect([numeroDicho("12"), numeroDicho("seis"), numeroDicho("dos docenas"), numeroDicho("nada")]).toEqual([12, 6, 24, null]);
  });
});

test.describe("la Guía en voz alta", () => {
  test("se arregla para el oído: bolivianos en vez de Bs, sin «»", () => {
    expect(paraHablar("Agregado a la venta · 2 × Coca Cola 2L · Bs 24,00")).toBe("Agregado a la venta, 2 Coca Cola 2L, 24,00 bolivianos");
    expect(paraHablar("Tip: decí «cobrale con QR».")).toBe("Un consejo: decí cobrale con QR.");
  });

  test("errores siempre; sugerencias solo si se contestan hablando, con la pista de cómo", () => {
    expect(fraseDeGuia(faltaPago)).toBe("Falta el método de pago. ¿Con qué paga?");
    expect(fraseDeGuia(cuantas)).toBe("No dijiste cuántas de Coca Cola 2L: puse 1. ¿Son más? Decí cuántas.");
    expect(fraseDeGuia(inusual)).toContain("Decí sí o no.");
    expect(fraseDeGuia(quedaPoco)).toBe("Después de esta venta te quedan 2 de Coca Cola 2L. ¿Anotar para comprar? Decí sí o no.");
  });

  test("los tips no se dicen (enseñan la pantalla, no sirven a quien dicta)", () => {
    expect(fraseDeGuia(MENSAJES.tipCobrarHablando())).toBeNull();
    expect(seContestaHablando(MENSAJES.tipCobrarHablando())).toBe(false);
  });
});

test.describe("la revisión silenciosa (D-G5)", () => {
  test("se pide en el modo aprendiz y no después", () => {
    expect(pideRevision(MEMORIA_VACIA, Date.now())).toBe(true);
    expect(pideRevision({ ...MEMORIA_VACIA, ventas: 25 }, Date.now())).toBe(false);
  });

  test("descartada tres veces seguidas, se calla 30 días", () => {
    const revision: MensajeGuia = { codigo: "REVISION", nivel: "sugerencia", mesa: "venta", texto: "x", acciones: [], clave: "R", confianza: 0.9 };
    const ahora = Date.now();
    const mem = [1, 2, 3].reduce((m, i) => descartar(m, { ...revision, clave: `R${i}` }, ahora), MEMORIA_VACIA);
    expect(pideRevision(mem, ahora)).toBe(false);
    expect(pideRevision(mem, ahora + 31 * 24 * 3600 * 1000)).toBe(true);
  });
});
