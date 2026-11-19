/**
 * Subtítulos al ritmo de la voz: qué palabras del texto ya se dijeron.
 *
 * La voz no trae la hora de cada palabra (Chirp no la da), pero el motor sí
 * sabe cuándo empezó a sonar y cuánto dura. Con eso se reparte el tiempo entre
 * las palabras según lo que "pesan" al decirse: las letras, los números (que
 * se dicen en letras: "27" suena "veintisiete") y las pausas de las comas y
 * los puntos. Una palabra aparece cuando empieza a sonar.
 */

export interface PalabraSubtitulo {
  texto: string;
  /** Dónde empieza, en "peso" acumulado desde el principio. */
  desde: number;
}

export interface TextoPesado {
  palabras: PalabraSubtitulo[];
  total: number;
}

/** Cuánto pesa una palabra al decirla, sin contar la pausa que viene después. */
function pesoDe(palabra: string): number {
  let peso = 0;
  for (const c of palabra) {
    if (/\d/.test(c)) peso += 3.5;
    else if (/[\p{L}]/u.test(c)) peso += 1;
    else if (c === "%" || c === "$" || c === "#") peso += 4;
  }
  // El espacio (y el arranque de cada palabra) también lleva tiempo.
  return Math.max(peso, 1) + 1;
}

/** La pausa que la voz hace después de la palabra. */
function pausaDespues(palabra: string): number {
  if (/[.!?…:;]["»”)]*$/.test(palabra)) return 7;
  if (/[,]["»”)]*$/.test(palabra)) return 4;
  return 0;
}

export function pesarTexto(texto: string): TextoPesado {
  const palabras: PalabraSubtitulo[] = [];
  let total = 0;
  for (const p of texto.split(/\s+/).filter(Boolean)) {
    palabras.push({ texto: p, desde: total });
    total += pesoDe(p) + pausaDespues(p);
  }
  return { palabras, total };
}

/**
 * Cuántas palabras mostrar con `fraccion` (0 a 1) de la voz ya sonada. Va
 * apenas adelantado (`adelanto`, en peso): la palabra se ve justo cuando
 * empieza a oírse, no cuando termina.
 */
export function palabrasVisibles(pesado: TextoPesado, fraccion: number, adelanto = 2): number {
  if (fraccion >= 1) return pesado.palabras.length;
  if (fraccion <= 0) return 0;
  const hasta = fraccion * pesado.total + adelanto;
  let n = 0;
  while (n < pesado.palabras.length && pesado.palabras[n].desde <= hasta) n++;
  return n;
}

/**
 * Peso por segundo de la voz (cuánto texto dice en un segundo), aprendido de
 * lo que ya sonó entero. Sirve para adelantar las palabras mientras la frase
 * todavía llega por partes y no se sabe cuánto va a durar.
 */
let ritmo = 15;

export function ritmoDeVoz(): number {
  return ritmo;
}

export function aprenderRitmo(total: number, segundos: number) {
  if (segundos < 0.6 || total < 8) return;
  const medido = total / segundos;
  if (medido < 5 || medido > 40) return;
  ritmo = ritmo * 0.6 + medido * 0.4;
}
