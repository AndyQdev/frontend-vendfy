import type { MensajeGuia } from "./guia";
import { respuestaAGuia } from "./respuesta-guia";

/**
 * La Guía en voz alta (Fase G2b, D-G2: la voz del navegador).
 *
 * Si se le está hablando al asistente, contesta hablando: frases cortas, no
 * la tarjeta entera. Errores y advertencias siempre; sugerencias solo si se
 * pueden contestar con la voz ("sí", "6", "con QR"); los tips nunca (enseñan
 * a usar la pantalla, y a quien está dictando no le sirven).
 *
 * Puro: se prueba en e2e/logic/respuesta-guia.spec.ts.
 */

/** "Bs 12,50" se lee "B S"; "2 × Coca" se lee "2 por Coca". Se arregla para el oído. */
export function paraHablar(texto: string): string {
  return texto
    .replace(/Bs\.?\s*([\d.,]+)/g, "$1 bolivianos")
    .replace(/\s×\s/g, " ")
    .replace(/\s·\s/g, ", ")
    .replace(/→/g, " a ")
    .replace(/~/g, "unos ")
    .replace(/[«»"“”]/g, "")
    .replace(/^Tip:\s*/, "Un consejo: ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * ¿Esta sugerencia se puede contestar hablando? Tiene que haber algo que
 * hacer además de cerrarla: un tip con solo "Entendido" no se resuelve con
 * la voz, se cierra solo.
 */
export function seContestaHablando(m: MensajeGuia): boolean {
  if (!m.acciones.some((a) => a.tipo !== "descartar")) return false;
  return (
    m.acciones.some((a) => a.tipo === "pago" || a.tipo === "cantidad") ||
    respuestaAGuia("sí", m) !== null ||
    respuestaAGuia("no", m) !== null
  );
}

/** Lo que dice en voz alta la Guía, o null si ese mensaje no se dice. */
export function fraseDeGuia(m: MensajeGuia): string | null {
  if (m.nivel !== "sugerencia") return paraHablar(m.texto);
  if (m.codigo.startsWith("TIP_") || !seContestaHablando(m)) return null;
  // La pista de cómo contestar, porque no hay botones a la vista del oído.
  let pista = "";
  if (m.acciones.some((a) => a.tipo === "pago")) pista = "";
  else if (m.codigo === "CANTIDAD_NO_DICHA") pista = " Decí cuántas.";
  else if (m.texto.includes("?")) pista = " Decí sí o no.";
  else {
    const si = respuestaAGuia("sí", m);
    pista = si && si.tipo !== "descartar" ? ` ¿${si.etiqueta}? Decí sí o no.` : "";
  }
  return paraHablar(m.texto + pista);
}
