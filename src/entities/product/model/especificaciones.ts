/**
 * Lectura de especificaciones pegadas de cualquier lado.
 *
 * Cargar una ficha técnica a mano es un par de campos por vez, y una lista de
 * diez acordes de un perfume son veinte pulsaciones de "Agregar". El atajo es
 * pegar la lista tal como viene -de un JSON, de una hoja de cálculo, de una
 * respuesta de IA, de la web del proveedor- y que el formulario la entienda.
 *
 * Por eso esto no exige UN formato. Prueba JSON primero y, si no lo es, lee el
 * texto línea por línea buscando un separador. Todo esto entra igual:
 *
 *   [{ "nombre": "Amaderado", "porcentaje": 22 }]   objetos con dos campos
 *   { "Amaderado": 22, "Cuero": 16 }                clave-valor directo
 *   [["Amaderado", 22]]                             pares
 *   Amaderado: 22                                   dos puntos
 *   Amaderado = 22                                  igual
 *   Amaderado<TAB>22                                pegado de Excel
 *   | Amaderado | 22 |                              tabla markdown
 *
 * El nombre de la columna de valor no se descarta: si la lista dice
 * "porcentaje" y el número viene pelado, el valor guardado es "22%". Es lo que
 * la persona quiso decir, y escribir el símbolo diez veces a mano es
 * exactamente el trabajo que este importador viene a evitar.
 */

import type { ResultadoParseo } from "@/shared/ui/importar-modal";

/** Un renglón ya interpretado, listo para entrar a `metadata.specifications`. */
export type ParEspecificacion = { clave: string; valor: string };

/** Tope defensivo: un pegado gigante es casi siempre un pegado equivocado. */
const MAXIMO_PARES = 200;

/** Nombres de campo que suelen contener el NOMBRE de la especificación. */
const CLAVES_NOMBRE = [
  "nombre", "name", "clave", "key", "label", "etiqueta", "titulo",
  "atributo", "attribute", "propiedad", "property", "campo", "spec",
  "caracteristica", "acorde", "nota", "note", "ingrediente",
];

/** Nombres de campo que suelen contener el VALOR. */
const CLAVES_VALOR = [
  "valor", "value", "porcentaje", "percentage", "percent", "pct",
  "cantidad", "quantity", "amount", "dato", "detalle", "detail",
  "descripcion", "description", "medida", "peso", "intensidad",
];

/** Campos cuyo número se lee como porcentaje. */
const ES_PORCENTAJE = /^(porcentaje|percentage|percent|pct|%)$/i;

/** Compara nombres de campo sin acentos ni mayúsculas: "Descripción" = "descripcion". */
export const normalizarClave = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const normalizar = normalizarClave;

/**
 * Busca en un objeto el primer campo que coincida con alguno de los alias.
 *
 * Un JSON pegado puede decir `nombre`, `name` o `cliente` para lo mismo, y
 * quien lo pega no tiene por qué saber cuál esperamos.
 */
export function campoPorAlias(
  obj: Record<string, unknown>,
  alias: string[],
): unknown {
  const clave = Object.keys(obj).find((k) => alias.includes(normalizar(k)));
  return clave === undefined ? undefined : obj[clave];
}

/**
 * Convierte lo que sea a texto mostrable.
 *
 * `claveOrigen` es el nombre del campo del que salió el valor, no el nombre de
 * la especificación: es lo que permite saber que un 22 suelto era un 22%.
 */
function formatearValor(valor: unknown, claveOrigen?: string): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  if (Array.isArray(valor)) {
    return valor.map((v) => formatearValor(v)).filter(Boolean).join(", ");
  }

  const porcentual = Boolean(claveOrigen && ES_PORCENTAJE.test(claveOrigen.trim()));

  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) return "";
    const texto = String(Number(valor.toFixed(4)));
    return porcentual ? texto + "%" : texto;
  }

  if (typeof valor === "object") return JSON.stringify(valor);

  const texto = String(valor).trim();
  // Un número pelado en una columna de porcentaje también lleva el símbolo.
  if (porcentual && /^-?\d+([.,]\d+)?$/.test(texto)) return texto + "%";
  return texto;
}

/** Busca en un objeto el campo que hace de nombre y el que hace de valor. */
function parDesdeObjeto(obj: Record<string, unknown>): ParEspecificacion | null {
  const claves = Object.keys(obj);
  if (claves.length === 0) return null;

  // Un solo campo: el objeto YA es el par. { "Amaderado": 22 }
  if (claves.length === 1) {
    const unica = claves[0];
    return { clave: unica.trim(), valor: formatearValor(obj[unica], unica) };
  }

  const buscar = (candidatas: string[]) =>
    claves.find((k) => candidatas.includes(normalizar(k)));

  let claveNombre = buscar(CLAVES_NOMBRE);
  let claveValor = buscar(CLAVES_VALOR);

  // Sin nombres reconocibles se cae al orden: el primer campo es el nombre y
  // el segundo el valor, que es como se escribe una lista de dos columnas.
  if (!claveNombre) claveNombre = claves.find((k) => k !== claveValor);
  if (!claveValor) claveValor = claves.find((k) => k !== claveNombre);
  if (!claveNombre || !claveValor) return null;

  const nombre = formatearValor(obj[claveNombre]);
  if (!nombre) return null;
  return { clave: nombre, valor: formatearValor(obj[claveValor], claveValor) };
}

/**
 * Corta una línea suelta en nombre y valor.
 *
 * El orden de los separadores importa: la coma va última porque aparece dentro
 * de los valores ("Material: algodón, lino") mucho más seguido que como
 * separador de columnas.
 */
function parDesdeLinea(linea: string): ParEspecificacion | null {
  let texto = linea.trim();
  if (!texto) return null;

  // Fila de tabla markdown: se le sacan los bordes y se parte por las barras.
  if (texto.startsWith("|")) {
    const celdas = texto.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    // La línea de guiones que separa el encabezado no es un dato.
    if (celdas.every((c) => /^:?-{2,}:?$/.test(c))) return null;
    if (celdas.length >= 2 && celdas[0]) {
      return { clave: celdas[0], valor: celdas.slice(1).join(" · ").trim() };
    }
    return null;
  }

  // Viñetas, numeración, llaves sueltas y comas finales del copiar-pegar.
  texto = texto
    .replace(/^[-*•·–—]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/^[[{]\s*/, "")
    .replace(/[\]}]\s*$/, "")
    .replace(/,$/, "")
    .trim();
  if (!texto) return null;

  const separadores = ["\t", ":", "=", "→", "->", ";", ",", "  "];
  for (const separador of separadores) {
    const corte = texto.indexOf(separador);
    if (corte <= 0) continue;
    const clave = limpiarCelda(texto.slice(0, corte));
    const valor = limpiarCelda(texto.slice(corte + separador.length));
    if (clave && valor) return { clave, valor };
  }
  return null;
}

/**
 * Parte el texto en líneas y descarta el encabezado de una tabla markdown.
 *
 * La línea de guiones (`|---|---|`) SIEMPRE va debajo del encabezado, así que
 * es la señal exacta de cuál es la fila que hay que tirar. Sin esto se
 * importaría una especificación llamada "Nombre" con el valor "Valor".
 */
function lineasDeDatos(texto: string): string[] {
  const lineas = texto.split(/\r?\n/);
  // Exige la barra: un `---` suelto es un separador visual de texto plano y
  // arriba puede haber una especificación de verdad que no hay que perder.
  const esSeparador = (l: string) =>
    l.includes("|") && /^\s*\|?[\s:|-]*\|[\s:|-]*$/.test(l) && /-{2,}/.test(l);

  return lineas.filter((linea, i) => {
    if (esSeparador(linea)) return false;
    // La fila anterior a los guiones es el encabezado de la tabla.
    return !(lineas[i + 1] !== undefined && esSeparador(lineas[i + 1]));
  });
}

/** Saca comillas y espacios de una celda recién cortada. */
function limpiarCelda(texto: string): string {
  return texto.trim().replace(/^["'“‘]|["'”’]$/g, "").trim();
}

/**
 * Intenta cerrar un JSON que se cortó al copiar.
 *
 * Pasa seguido: se selecciona con el mouse y se pierde el final. Leerlo como
 * texto suelto da resultados feos -cada línea se parte por el primer `:` y
 * quedan claves llamadas "nombre"-, así que antes de rendirse se prueba
 * recortando hasta el último objeto completo y cerrando el arreglo.
 */
function repararJson(texto: string): unknown | undefined {
  const candidatos: string[] = [];

  if (texto.startsWith("[")) {
    const ultimoObjeto = texto.lastIndexOf("}");
    if (ultimoObjeto > 0) candidatos.push(texto.slice(0, ultimoObjeto + 1) + "]");
    candidatos.push(texto.replace(/,\s*$/, "") + "]");
  } else {
    const ultimoValor = texto.lastIndexOf(",");
    if (ultimoValor > 0) candidatos.push(texto.slice(0, ultimoValor) + "}");
    candidatos.push(texto.replace(/,\s*$/, "") + "}");
  }

  for (const candidato of candidatos) {
    try {
      return JSON.parse(candidato);
    } catch {
      // Se sigue con el próximo intento.
    }
  }
  return undefined;
}

/** Aplana lo que devolvió `JSON.parse` a una lista de pares. */
function paresDesdeJson(datos: unknown): ParEspecificacion[] {
  if (Array.isArray(datos)) {
    return datos.flatMap((item) => {
      if (typeof item === "string") {
        const par = parDesdeLinea(item);
        return par ? [par] : [];
      }
      // ["Amaderado", 22]
      if (Array.isArray(item)) {
        const clave = formatearValor(item[0]);
        return clave ? [{ clave, valor: formatearValor(item[1]) }] : [];
      }
      if (item && typeof item === "object") {
        const par = parDesdeObjeto(item as Record<string, unknown>);
        return par ? [par] : [];
      }
      return [];
    });
  }

  if (datos && typeof datos === "object") {
    const entradas = Object.entries(datos as Record<string, unknown>);
    return entradas.flatMap(([clave, valor]) => {
      const nombre = clave.trim();
      if (!nombre) return [];
      // { "especificaciones": [...] }: se entra al arreglo en vez de guardarlo
      // como un texto ilegible.
      if (Array.isArray(valor) && valor.some((v) => v && typeof v === "object")) {
        return paresDesdeJson(valor);
      }
      return [{ clave: nombre, valor: formatearValor(valor, clave) }];
    });
  }

  return [];
}

/**
 * Lee el texto pegado. Nunca lanza: los problemas vuelven en `error` para
 * poder mostrarlos junto al textarea en vez de romper el formulario.
 */
export function parsearEspecificaciones(
  texto: string,
): ResultadoParseo<ParEspecificacion> {
  const limpio = texto.trim();
  if (!limpio) return { items: [], formato: "", error: null };

  let pares: ParEspecificacion[] = [];
  let formato = "texto";

  const pareceJson = /^[[{]/.test(limpio);
  if (pareceJson) {
    try {
      pares = paresDesdeJson(JSON.parse(limpio));
      formato = "JSON";
    } catch {
      const reparado = repararJson(limpio);
      if (reparado !== undefined) {
        pares = paresDesdeJson(reparado);
        formato = "JSON (venía cortado y se completó)";
      } else {
        // Si ni así, se lee línea por línea: casi siempre alcanza para
        // rescatar los datos.
        pares = [];
        formato = "texto";
      }
    }
  }

  if (pares.length === 0) {
    pares = lineasDeDatos(limpio)
      .map(parDesdeLinea)
      .filter((p): p is ParEspecificacion => p !== null);
  }

  // Se limpia y se quitan repetidos: gana el último, que es como se comporta
  // sobrescribir una clave.
  const porClave = new Map<string, string>();
  for (const par of pares) {
    const clave = par.clave.trim().replace(/[:=]$/, "").trim();
    const valor = par.valor.trim();
    if (!clave || !valor) continue;
    porClave.set(clave, valor);
  }

  const finales = Array.from(porClave, ([clave, valor]) => ({ clave, valor }));

  if (finales.length === 0) {
    return {
      items: [],
      formato: "",
      error:
        "No se reconoció ningún dato. Cada renglón necesita un nombre y un valor separados por dos puntos, tabulación o igual.",
    };
  }

  if (finales.length > MAXIMO_PARES) {
    return {
      items: finales.slice(0, MAXIMO_PARES),
      formato,
      error: `Se leyeron ${finales.length} filas y solo se van a importar las primeras ${MAXIMO_PARES}.`,
    };
  }

  return { items: finales, formato, error: null };
}
