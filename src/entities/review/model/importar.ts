import { campoPorAlias } from "@/entities/product/model/especificaciones";
import type { ResultadoParseo } from "@/shared/ui/importar-modal";

/**
 * Lectura de reseñas pegadas.
 *
 * Cargar cuatro testimonios a mano es abrir el diálogo cuatro veces y escribir
 * nombre, estrellas y comentario en cada una. El atajo es pegar el JSON tal
 * como viene -de una IA, de una planilla, de las capturas ya transcriptas- y
 * crearlas todas de una.
 *
 *   [{ "name": "Juan Perez", "rating": 4.5, "comment": "…" }]
 *   [{ "cliente": "Ana", "estrellas": 5, "comentario": "…" }]
 *   Juan Perez | 5 | Muy buen perfume
 *
 * Las estrellas se guardan enteras porque así está la columna, así que un 4.5
 * entra como 5 y la vista previa lo muestra redondeado ANTES de importar: es
 * mejor verlo que descubrirlo después en la tienda.
 */

export type ResenaImportada = {
  customerName: string;
  /** Ya redondeada y acotada a 1-5, que es lo que acepta el backend. */
  rating: number | null;
  comment: string;
  /** Lo que decía el texto pegado, si no era un entero de 1 a 5. */
  ratingOriginal: number | null;
};

const CLAVES_NOMBRE = [
  "name", "nombre", "customername", "customer_name", "cliente", "customer",
  "autor", "author", "usuario", "user", "quien",
];

const CLAVES_RATING = [
  "rating", "estrellas", "stars", "calificacion", "puntuacion", "puntaje",
  "score", "nota", "valoracion", "puntos",
];

const CLAVES_COMENTARIO = [
  "comment", "comentario", "texto", "text", "review", "resena", "opinion",
  "mensaje", "message", "body", "contenido", "testimonio", "descripcion",
];

/** Un pegado gigante es casi siempre un pegado equivocado. */
const MAXIMO_RESENAS = 100;

/** Interpreta las estrellas vengan como número, como "4,5" o como "4/5". */
function leerRating(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;

  let numero: number;
  if (typeof valor === "number") {
    numero = valor;
  } else if (typeof valor === "string") {
    const texto = valor.trim().replace(",", ".").replace(/\s*\/\s*5$/, "");
    // "★★★★☆" también es una calificación perfectamente legible.
    const estrellas = (valor.match(/[★⭐]/g) || []).length;
    if (estrellas > 0) return Math.min(5, estrellas);
    numero = Number(texto);
  } else {
    return null;
  }

  if (!Number.isFinite(numero)) return null;
  return numero;
}

/** Lee un objeto del JSON pegado. Descarta lo que el backend no aceptaría. */
function resenaDesdeObjeto(obj: Record<string, unknown>): ResenaImportada | null {
  const nombre = campoPorAlias(obj, CLAVES_NOMBRE);
  const comentario = campoPorAlias(obj, CLAVES_COMENTARIO);

  const customerName = typeof nombre === "string" ? nombre.trim() : "";
  const comment = typeof comentario === "string" ? comentario.trim() : "";
  // Sin nombre y sin comentario no hay reseña: el backend exige el nombre, y
  // una reseña vacía no le sirve a nadie.
  if (!customerName || !comment) return null;

  const crudo = leerRating(campoPorAlias(obj, CLAVES_RATING));
  return armar(customerName, crudo, comment);
}

/** Redondea y acota las estrellas, recordando el valor original si cambió. */
function armar(
  customerName: string,
  crudo: number | null,
  comment: string,
): ResenaImportada {
  if (crudo === null) {
    return { customerName, rating: null, comment, ratingOriginal: null };
  }
  const rating = Math.min(5, Math.max(1, Math.round(crudo)));
  return {
    customerName,
    rating,
    comment,
    ratingOriginal: rating === crudo ? null : crudo,
  };
}

/**
 * Una reseña por línea, con barras o tabulaciones: `Nombre | 5 | Comentario`.
 * El número puede faltar, y si falta la línea es nombre y comentario.
 */
function resenaDesdeLinea(linea: string): ResenaImportada | null {
  const texto = linea.trim().replace(/^\|/, "").replace(/\|$/, "");
  if (!texto) return null;

  const celdas = texto.split(/\s*[|\t]\s*/).map((c) => c.trim());
  if (celdas.length < 2) return null;
  if (celdas.every((c) => /^:?-{2,}:?$/.test(c))) return null;

  const customerName = celdas[0];
  if (!customerName) return null;

  // La segunda celda son las estrellas solo si es un número; si no, ya es el
  // comentario y la reseña viene sin calificación.
  const segundaEsNumero = /^\s*\d+([.,]\d+)?\s*(\/\s*5)?\s*$/.test(celdas[1]);
  const crudo = segundaEsNumero ? leerRating(celdas[1]) : null;
  const comment = (segundaEsNumero ? celdas.slice(2) : celdas.slice(1))
    .join(" ")
    .trim();
  if (!comment) return null;

  return armar(customerName, crudo, comment);
}

/** Aplana lo que salió de `JSON.parse` a una lista de reseñas. */
function resenasDesdeJson(datos: unknown): ResenaImportada[] {
  if (Array.isArray(datos)) {
    return datos.flatMap((item) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const resena = resenaDesdeObjeto(item as Record<string, unknown>);
        return resena ? [resena] : [];
      }
      return [];
    });
  }

  if (datos && typeof datos === "object") {
    const obj = datos as Record<string, unknown>;
    // { "reviews": [...] }: se entra al arreglo.
    const arreglo = Object.values(obj).find((v) => Array.isArray(v));
    if (arreglo) return resenasDesdeJson(arreglo);
    const una = resenaDesdeObjeto(obj);
    return una ? [una] : [];
  }

  return [];
}

/**
 * Lee el texto pegado. Nunca lanza: los problemas vuelven en `error` para
 * mostrarlos junto al textarea.
 */
export function parsearResenas(texto: string): ResultadoParseo<ResenaImportada> {
  const limpio = texto.trim();
  if (!limpio) return { items: [], formato: "", error: null };

  let items: ResenaImportada[] = [];
  let formato = "texto";

  if (/^[[{]/.test(limpio)) {
    try {
      items = resenasDesdeJson(JSON.parse(limpio));
      formato = "JSON";
    } catch {
      items = [];
      formato = "texto";
    }
  }

  if (items.length === 0) {
    items = limpio
      .split(/\r?\n/)
      .map(resenaDesdeLinea)
      .filter((r): r is ResenaImportada => r !== null);
  }

  if (items.length === 0) {
    return {
      items: [],
      formato: "",
      error:
        "No se reconoció ninguna reseña. Cada una necesita al menos un nombre y un comentario.",
    };
  }

  const advertencias: string[] = [];

  const ajustadas = items.filter((r) => r.ratingOriginal !== null).length;
  if (ajustadas > 0) {
    advertencias.push(
      ajustadas === 1
        ? "1 calificación se ajustó: las estrellas se guardan enteras del 1 al 5."
        : `${ajustadas} calificaciones se ajustaron: las estrellas se guardan enteras del 1 al 5.`,
    );
  }

  if (items.length > MAXIMO_RESENAS) {
    advertencias.push(
      `Se leyeron ${items.length} reseñas y solo se van a importar las primeras ${MAXIMO_RESENAS}.`,
    );
    items = items.slice(0, MAXIMO_RESENAS);
  }

  return {
    items,
    formato,
    error: advertencias.length > 0 ? advertencias.join(" ") : null,
  };
}
