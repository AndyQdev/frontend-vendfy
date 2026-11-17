/**
 * Lo que la persona contesta a una pregunta del piloto ("¿Con qué paga?",
 * "¿Lo cobro?", "¿Algo más?") sin volver a decir "Oye Vendfy".
 *
 * Solo frases cortas y conocidas: cualquier otra cosa ("y una fanta más") es
 * un pedido nuevo y va al servidor como cualquier frase.
 */

import { numeroDicho } from "@/features/omnibox/model/respuesta-guia";

export type PagoPiloto = "efectivo" | "qr" | "tarjeta" | "dolares";

/** Lo que el piloto está esperando oír. */
export type PreguntaPiloto = "pago" | "confirmar" | "seguir" | "precio" | "cantidad";

export type RespuestaPiloto =
  | { tipo: "pago"; pago: PagoPiloto; confirma: boolean }
  | { tipo: "si" }
  | { tipo: "no" }
  | { tipo: "cobrar" }
  | { tipo: "numero"; valor: number }
  | { tipo: "parar" };

/** Una respuesta tiene pocas palabras: "sí, con QR, cóbrale" ya es el tope. */
const PALABRAS_MAXIMAS = 6;

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PAGOS: [PagoPiloto, RegExp][] = [
  ["dolares", /\b(dolar(es)?|verdes?)\b/],
  ["qr", /\b(qr|q r|cu ?erre|codigo|transferencia|simple)\b/],
  ["tarjeta", /\b(tarjeta|debito|credito|pos)\b/],
  ["efectivo", /\b(efectivo|contado|billetes?|cash|plata)\b/],
];

const PARAR = /^(para|parale|detente|cancela(lo)?|olvidalo|basta|deja(lo)?|chau|adios|nada mas gracias|eso es todo gracias)$/;

/**
 * "Sí" y sus formas. Whisper a veces escribe un "sí" suelto como "C." o "Se."
 * (lo vimos en el alta por voz): una sola letra así también es "sí".
 */
const SI = /^(si+|c|se|claro|dale|ya|ok|okey|okay|correcto|exacto|eso|asi es|de una|por favor|confirmo|hazlo|adelante|perfecto)( (si|claro|dale|por favor|eso))*$/;

const NO = /^(no|nop|todavia no|aun no|espera|esperate|mejor no|no gracias|nada|nada mas|eso es todo|es todo|ya esta|nomas)$/;

/** "Cóbrale", "cobra", "ya cobra", "cóbralo con QR". */
const COBRAR = /\bcobr(a|ale|alo|ar|ame)\b/;

/** Una pregunta ("¿a cuánto está el dólar?") nunca es una respuesta. */
const PREGUNTA = /^(a cuanto|cuanto|cuantos|cuantas|como|que|cual|cuales|cuando|donde|quien|por que)\b/;

/** Sin una pregunta de por medio, el método tiene que venir dicho como pago: "con QR", "paga en efectivo". */
const COMO_PAGO = /\b(con|en|paga|pagan|pago|cobr\w*)\b/;

export function leerRespuesta(texto: string, pregunta: PreguntaPiloto | null): RespuestaPiloto | null {
  const t = normalizar(texto);
  if (!t) return null;
  if (PARAR.test(t)) return { tipo: "parar" };

  // "¿A cuánto lo vendes?" / "¿Cuántas tienes?": un número ("8,50", "doce").
  if (pregunta === "precio" || pregunta === "cantidad") {
    if (pregunta === "cantidad" && NINGUNA.test(t)) return { tipo: "numero", valor: 0 };
    const valor = numeroDe(texto);
    if (valor != null && t.split(" ").length <= PALABRAS_MAXIMAS) return { tipo: "numero", valor };
  }
  if (t.split(" ").length > PALABRAS_MAXIMAS) return null;
  if (PREGUNTA.test(t) || texto.includes("?")) return null;

  const pago = PAGOS.find(([, re]) => re.test(t))?.[0];
  if (pago && (pregunta === "pago" || pregunta === "confirmar" || COMO_PAGO.test(t))) {
    // "Sí, con QR" o "cóbrale con QR": ya dijo que sí además del método.
    const confirma = /^(si|c|se|dale|claro|ok)\b/.test(t) || COBRAR.test(t);
    return { tipo: "pago", pago, confirma };
  }
  if (COBRAR.test(t)) return { tipo: "cobrar" };
  if (SI.test(t)) return { tipo: "si" };
  if (NO.test(t)) return { tipo: "no" };
  // Un número o un producto ya no es una respuesta: es un pedido.
  return null;
}

/** "No tengo ninguna" a "¿Cuántas tienes?" es cero. */
const NINGUNA = /^(ninguna|ninguno|nada|cero|no tengo|no tengo ninguna|no hay|todavia ninguna|no)$/;

/** El número de una respuesta: con decimales ("8,50", "12.5") o en palabras ("doce"). */
export function numeroDe(texto: string): number | null {
  const m = texto.match(/(\d+(?:[.,]\d{1,2})?)/);
  if (m) return Number(m[1].replace(",", "."));
  return numeroDicho(texto);
}

export const NOMBRE_PAGO: Record<PagoPiloto, string> = {
  efectivo: "efectivo",
  qr: "QR",
  tarjeta: "tarjeta",
  dolares: "dólares",
};
