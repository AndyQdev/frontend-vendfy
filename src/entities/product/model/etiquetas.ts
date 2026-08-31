import { campoPorAlias, normalizarClave } from "./especificaciones";
import type { ResultadoParseo } from "@/shared/ui/importar-modal";

/**
 * Lectura de etiquetas pegadas.
 *
 * Una etiqueta es una sola palabra, así que acá no hay que adivinar columnas:
 * lo único que importa es dónde termina una y empieza la otra. Entra todo esto:
 *
 *   ["perfume", "masculino", "elegante"]     arreglo JSON
 *   [{ "nombre": "perfume" }]                arreglo de objetos
 *   perfume, masculino, elegante             separadas por coma
 *   #perfume #masculino                      hashtags
 *   una por línea                            pegado de una lista
 *
 * Se comparan sin acentos ni mayúsculas para no terminar con "Premium" y
 * "premium" como dos etiquetas distintas, pero se guarda el texto tal como se
 * escribió.
 */

/**
 * Forma canónica de una etiqueta, para comparar sin acentos ni mayúsculas.
 * Se compara con esto pero se GUARDA el texto tal como se escribió.
 */
export const normalizarEtiqueta = normalizarClave;

/** Nombres de campo que contienen la etiqueta dentro de un objeto. */
const CLAVES_ETIQUETA = ["nombre", "name", "etiqueta", "tag", "label", "valor", "value", "texto", "text"];

/** Un pegado gigante es casi siempre un pegado equivocado. */
const MAXIMO_ETIQUETAS = 100;

/** Saca comillas, viñetas, corchetes, comas finales y el `#` de los hashtags. */
function limpiarEtiqueta(texto: string): string {
  return texto
    .trim()
    .replace(/^[-*•·]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/^[[{]+/, "")
    .replace(/[\]}]+$/, "")
    .replace(/,+$/, "")
    .replace(/^["'“‘]+|["'”’]+$/g, "")
    .replace(/^#+/, "")
    .trim();
}

/** Aplana lo que salió de `JSON.parse` a una lista de textos. */
function etiquetasDesdeJson(datos: unknown): string[] {
  if (typeof datos === "string" || typeof datos === "number") {
    return [String(datos)];
  }

  if (Array.isArray(datos)) return datos.flatMap(etiquetasDesdeJson);

  if (datos && typeof datos === "object") {
    const obj = datos as Record<string, unknown>;
    // { "tags": [...] }: se entra al arreglo en vez de quedarse con la llave.
    const arreglo = Object.entries(obj).find(([, v]) => Array.isArray(v));
    if (arreglo) return etiquetasDesdeJson(arreglo[1]);

    const campo = campoPorAlias(obj, CLAVES_ETIQUETA);
    if (typeof campo === "string" || typeof campo === "number") {
      return [String(campo)];
    }
    // Sin campo reconocible, un objeto de una sola llave es la etiqueta misma.
    const claves = Object.keys(obj);
    return claves.length === 1 ? [claves[0]] : [];
  }

  return [];
}

/**
 * Lee el texto pegado. Nunca lanza: los problemas vuelven en `error` para
 * mostrarlos junto al textarea.
 */
export function parsearEtiquetas(texto: string): ResultadoParseo<string> {
  const limpio = texto.trim();
  if (!limpio) return { items: [], formato: "", error: null };

  let crudas: string[] = [];
  let formato = "texto";

  if (/^[[{]/.test(limpio)) {
    try {
      crudas = etiquetasDesdeJson(JSON.parse(limpio));
      formato = "JSON";
    } catch {
      // Un JSON cortado al copiar se lee igual: acá cada etiqueta está en su
      // propia línea o separada por comas, así que la sintaxis sobra.
      crudas = [];
      formato = "texto";
    }
  }

  if (crudas.length === 0) {
    // Las etiquetas nunca llevan comas adentro, así que cortar por coma y por
    // salto de línea a la vez es seguro.
    crudas = limpio.split(/[\n,;]+/);
  }

  const vistas = new Set<string>();
  const items: string[] = [];
  for (const cruda of crudas) {
    // Un renglón puede traer varios hashtags juntos: "#perfume #elegante".
    const pedazos = cruda.includes("#") ? cruda.split(/\s+/) : [cruda];
    for (const pedazo of pedazos) {
      const etiqueta = limpiarEtiqueta(pedazo);
      if (!etiqueta) continue;
      const llave = normalizarClave(etiqueta);
      if (vistas.has(llave)) continue;
      vistas.add(llave);
      items.push(etiqueta);
    }
  }

  if (items.length === 0) {
    return {
      items: [],
      formato: "",
      error: "No se reconoció ninguna etiqueta. Poné una por línea, separadas por comas o como un arreglo JSON.",
    };
  }

  if (items.length > MAXIMO_ETIQUETAS) {
    return {
      items: items.slice(0, MAXIMO_ETIQUETAS),
      formato,
      error: `Se leyeron ${items.length} etiquetas y solo se van a importar las primeras ${MAXIMO_ETIQUETAS}.`,
    };
  }

  return { items, formato, error: null };
}
