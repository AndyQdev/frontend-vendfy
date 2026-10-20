/**
 * Lo que la voz dice con palabras: números en letras y el nombre corto de un
 * producto. Igual que en el servidor (`voz/frases.ts`): una frase se guarda
 * por su texto, y "Tienes cuatro." tiene que salir idéntica en todos lados
 * para generarse una sola vez.
 */

const HASTA_29 = [
  "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve",
  "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete",
  "veintiocho", "veintinueve",
];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = [
  "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos",
  "ochocientos", "novecientos",
];

function hasta999(n: number): string {
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c]);
  if (r) partes.push(r < 30 ? HASTA_29[r] : `${DECENAS[Math.floor(r / 10)]}${r % 10 ? ` y ${HASTA_29[r % 10]}` : ""}`);
  return partes.join(" ");
}

/** "uno" delante de un sustantivo masculino: "veintiún clientes", "un pedido". */
export function apocopar(letras: string): string {
  return letras.replace(/veintiuno$/, "veintiún").replace(/(^|\s)uno$/, "$1un");
}

/** Entero de 0 a 999.999.999 en letras: 4 → "cuatro", 121 → "ciento veintiuno". */
export function numeroALetras(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n >= 1e9) return String(n);
  if (n === 0) return "cero";
  const millones = Math.floor(n / 1e6);
  const miles = Math.floor((n % 1e6) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? "un millón" : `${apocopar(numeroALetras(millones))} millones`);
  if (miles) partes.push(miles === 1 ? "mil" : `${apocopar(hasta999(miles))} mil`);
  if (resto) partes.push(hasta999(resto));
  return partes.join(" ");
}

export const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Palabras que no cierran un nombre: "Mermelada Arcor de" → "Mermelada Arcor". */
const NO_CIERRAN = new Set([
  "de", "del", "la", "el", "los", "las", "con", "y", "e", "o", "en", "para", "sin", "a", "al", "por", "x", "-", "+",
]);

/**
 * Cómo se nombra un producto en voz alta: las primeras tres palabras, sin
 * medidas ni números ("500g", "x12", "1L") y sin un "de" suelto al final.
 *
 *   "Mermelada Arcor de frutilla 500g" → "Mermelada Arcor"
 *   "Papel higiénico Suave x4"         → "Papel higiénico Suave"
 *   "Café Nescafé 200g"                → "Café Nescafé"
 */
export function nombreCorto(nombre: string, palabras = 3): string {
  const limpias = nombre
    .replace(/[()[\]{}"“”«»,;:!¡?¿/|_*#]+/g, " ")
    .split(/\s+/)
    .map((p) => p.replace(/^[.\-'+]+|[.\-'+]+$/g, ""))
    .filter((p) => p && !/\d/.test(p));
  const elegidas = limpias.slice(0, palabras);
  while (elegidas.length > 1 && NO_CIERRAN.has(elegidas[elegidas.length - 1].toLowerCase())) elegidas.pop();
  const corto = elegidas.join(" ").slice(0, 40).trim();
  return corto || nombre.trim().split(/\s+/).slice(0, 2).join(" ");
}

/** "hoy", "ayer", "hace cinco días", "hace un mes": cuándo fue, para decirlo. */
export function haceCuantoEnLetras(iso: string | null | undefined, ahora = new Date()): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((dia(ahora) - dia(fecha)) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 31) return `hace ${numeroALetras(dias)} días`;
  const meses = Math.round(dias / 30);
  if (meses < 12) return meses === 1 ? "hace un mes" : `hace ${apocopar(numeroALetras(meses))} meses`;
  const anios = Math.round(dias / 365);
  return anios === 1 ? "hace un año" : `hace ${apocopar(numeroALetras(anios))} años`;
}
