/**
 * Lo que se pidió después de "Oye Vendfy", cuando el servidor no la encontró al
 * principio de la transcripción.
 *
 * El oído manda los 2 s anteriores a la palabra (para no cortarla), y ahí entra
 * lo que se dijo antes ("a ver, a ver…") o lo que Whisper inventa sobre el
 * silencio ("Gracias."). Con la palabra en el medio, o escrita raro, el pedido
 * es lo que sigue; si Whisper ni la escribió, el detector del equipo ya la oyó
 * y el pedido es todo lo dicho.
 */
const LLAMADO =
  /(?:^|\s)(?:(?:oye|oie|oi|oy|hoy|olle|o ye|hey|ey)\s+)?(?:[bvw]en(?:d|t)?\s?(?:f|ph)(?:y|i|ai|ay|ie|ei|a|e)?|vendify|bendify|wendy|bendy)(?=\s|$)/;

/** Frases que Whisper inventa sobre el silencio o el ruido. */
const ALUCINACION = /^(?:\s*(?:gracias(?: por ver)?|subt[ií]tulos[^.!?]*|amara\.org[^.!?]*|m[uú]sica|aplausos)[.!?,]*)+\s*/i;

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!.,;:"«»()\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cuántas palabras de verdad tiene (sin signos). */
export function cuantasPalabras(texto: string): number {
  return normalizar(texto).split(" ").filter(Boolean).length;
}

export function pedidoTrasLaPalabra(texto: string): string {
  const limpio = normalizar(texto);
  const m = LLAMADO.exec(limpio);
  // Solo cuenta si la palabra está entre las primeras: "…y le dije a Wendy" al final no es el llamado.
  const antesDe = m ? limpio.slice(0, m.index).split(" ").filter(Boolean).length : Infinity;
  if (m && antesDe <= 8) {
    const hasta = limpio.slice(0, m.index + m[0].length).trim().split(" ").filter(Boolean).length;
    const tiras = [...texto.matchAll(/[\p{L}\p{N}]+/gu)];
    const corte = tiras[hasta - 1];
    return corte
      ? texto
          .slice(corte.index! + corte[0].length)
          .replace(/^[\s,.;:!\-–—]+/, "")
          .trim()
      : "";
  }
  return texto.replace(ALUCINACION, "").trim();
}
