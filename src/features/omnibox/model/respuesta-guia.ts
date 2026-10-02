import type { AccionGuia, MensajeGuia } from "./guia";
import type { MetodoPago } from "./mesa";

/**
 * Contestarle a la Guía (Fase G2b): cuando la Guía preguntó algo ("No dijiste
 * cuántas: ¿son más?", "¿Con qué paga?", "¿Seguro 100?"), la frase siguiente
 * puede ser la respuesta: "6", "con QR", "sí", "no, dejalo".
 *
 * Se resuelve acá, sin servidor ni IA: es elegir uno de los botones que la
 * Guía ya muestra. Solo frases cortas: "vendé 2 cocas con QR" no es una
 * respuesta, es una venta nueva, y va al servidor como siempre.
 *
 * Puro: se prueba en e2e/logic/respuesta-guia.spec.ts.
 */

/** Más palabras que esto ya no es contestar, es pedir otra cosa. */
export const PALABRAS_MAXIMAS = 5;

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[¿?¡!.,;:«»"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const NUMEROS: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, veinticuatro: 24, treinta: 30, cuarenta: 40, cincuenta: 50, cien: 100,
};

/** "6", "seis", "una docena", "media docena", "que sean 12" → el número. */
export function numeroDicho(texto: string): number | null {
  const t = normalizar(texto);
  if (/\bmedia docena\b/.test(t)) return 6;
  const docenas = t.match(/\b(\d+|un|una|dos|tres|cuatro)?\s*docenas?\b/);
  if (docenas) return 12 * (docenas[1] ? Number(docenas[1]) || NUMEROS[docenas[1]] || 1 : 1);
  const digitos = t.match(/\b(\d{1,4})\b/);
  if (digitos) return Number(digitos[1]);
  for (const palabra of t.split(" ")) if (NUMEROS[palabra] != null) return NUMEROS[palabra];
  return null;
}

/**
 * Las palabras que puede tener una respuesta además de lo que contesta. Si la
 * frase trae cualquier otra ("la COCA me SALIÓ a 10"), no es una respuesta:
 * habla de otra cosa y va al servidor. Sin esto, "la coca me salió a 10"
 * con un "¿cuántas?" pendiente cambiaba la cantidad en vez del costo.
 */
const RELLENO = new Set(
  (
    "que sean son seran es eran dejalo deja dejala en hace hacelo haceme hacé ponele pone mejor solo nomas " +
    "unidades unidad docena docenas media y o el la los las un una de del con por paga pago pagan cobrale cobra " +
    "cobrá cobrame si sip no nop nel dale ok okey okay bueno claro listo ya correcto exacto eso gracias favor " +
    "esta bien asi ahora hace falta nada anotalo agregalo cargalo sumalo vez"
  ).split(" "),
);

const PALABRAS_DE_PAGO = /^(qr|q|r|cu|erre|kuerre|transferencia|efectivo|cash|mano|billete|tarjeta|debito|credito|pos)$/;

/** ¿La frase es solo la respuesta (y relleno), o trae palabras de otra cosa? */
function soloRespuesta(t: string): boolean {
  return t.split(" ").every((p) => RELLENO.has(p) || /^\d+$/.test(p) || NUMEROS[p] != null || PALABRAS_DE_PAGO.test(p));
}

const SI = /^(si|sip|dale|ok|okey|okay|bueno|claro|de una|listo|ya|correcto|exacto|eso|hacelo|anotalo|agregalo|cargalo|sumalo)\b/;
const NO = /^(no|nop|nel|nada|dejalo|deja|asi esta bien|esta bien|asi nomas|ahora no|no gracias|no hace falta)\b/;

function pagoDicho(t: string): MetodoPago | null {
  if (/\b(qr|q r|cu erre|kuerre|transferencia)\b/.test(t)) return "qr";
  if (/\b(efectivo|cash|en mano|billete)\b/.test(t)) return "efectivo";
  if (/\b(tarjeta|debito|credito|pos)\b/.test(t)) return "tarjeta";
  return null;
}

/**
 * La acción que responde a la Guía, o null si la frase no es una respuesta
 * (y entonces va al servidor como cualquier otra).
 */
export function respuestaAGuia(texto: string, m: MensajeGuia | null): AccionGuia | null {
  if (!m || m.acciones.length === 0) return null;
  const t = normalizar(texto);
  if (!t || t.split(" ").length > PALABRAS_MAXIMAS || !soloRespuesta(t)) return null;

  // ¿Con qué paga?
  const pagos = m.acciones.filter((a): a is Extract<AccionGuia, { tipo: "pago" }> => a.tipo === "pago");
  if (pagos.length > 0) {
    const pago = pagoDicho(t);
    return pagos.find((a) => a.pago === pago) ?? null;
  }

  const descartar = m.acciones.find((a) => a.tipo === "descartar") ?? null;
  // "¿Seguro 100?" → "Sí, son 100" es dejarlo: la etiqueta dice qué es el sí.
  const conSi = m.acciones.find((a) => normalizar(a.etiqueta).startsWith("si "));
  const principales = m.acciones.filter((a) => a.tipo !== "descartar");
  const unica = principales.length === 1 ? principales[0] : null;

  // ¿Cuántas? Un número es la cantidad, aunque no sea uno de los botones.
  const cantidad = m.acciones.find((a): a is Extract<AccionGuia, { tipo: "cantidad" }> => a.tipo === "cantidad");
  const n = numeroDicho(t);
  // "No, que sean 3": el número manda sobre el "no".
  if (cantidad && n != null) {
    if (n === 1 && m.codigo === "CANTIDAD_NO_DICHA" && descartar) return descartar; // "es 1": ya está
    if (n < 1 || n > 9999) return null;
    return { ...cantidad, cantidad: n, etiqueta: String(n) };
  }

  if (NO.test(t)) {
    if (conSi && conSi.tipo === "descartar") return unica; // "no" a "¿Seguro 100?" = la cantidad de siempre
    if (descartar) return descartar;
    // Una sugerencia sin botón de descartar igual se puede rechazar; un error, no.
    return m.nivel === "sugerencia" ? { tipo: "descartar", etiqueta: "No" } : null;
  }
  if (SI.test(t)) return conSi ?? unica;
  return null;
}

/** Lo que queda en el chat cuando se contestó: "Paga con QR", "Ahora son 6". */
export function resumenRespuesta(a: AccionGuia): string {
  switch (a.tipo) {
    case "pago":
      return `Paga con ${a.etiqueta}`;
    case "cantidad":
      return a.cantidad === 0 ? "Lo saqué" : `Ahora son ${a.cantidad}`;
    case "descartar":
      return "Listo, queda así";
    default:
      return a.etiqueta;
  }
}
