/**
 * Listas y fichas del chat (G9a), la parte pura: cómo se ve cada celda, de
 * qué color es un estado, por qué columna se ordena y qué queda al sacar un
 * chip. Sin React: se prueba en e2e/logic/recursos.spec.ts.
 */

import type { ConsultaRecurso, FormatoColumna, ListaRecurso, ValorFiltro } from "@/entities/omnibox/model/types";

import type { HojaExcel } from "./excel";

const dosDecimales = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const entero = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 2 });

/** "2026-09-30 19:54" → "30/09/26 19:54"; "2026-09-30" → "30/09/26". */
export function fechaCorta(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(v);
  if (!m) return v;
  return `${m[3]}/${m[2]}/${m[1].slice(2)}${m[4] ? ` ${m[4]}:${m[5]}` : ""}`;
}

/** El valor de una celda como se lee: "Bs 1.234,50", "30/09/26 19:54", "—". */
export function celda(valor: unknown, formato: FormatoColumna): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  switch (formato) {
    case "dinero": {
      const n = Number(valor);
      return Number.isFinite(n) ? `Bs ${dosDecimales.format(n)}` : String(valor);
    }
    case "numero": {
      const n = Number(valor);
      return Number.isFinite(n) ? entero.format(n) : String(valor);
    }
    case "porcentaje": {
      const n = Number(valor);
      return Number.isFinite(n) ? `${entero.format(n)} %` : String(valor);
    }
    case "fecha":
      return fechaCorta(String(valor));
    default:
      return String(valor);
  }
}

export type Tono = "exito" | "aviso" | "error" | "info" | "neutro";

/** El color de un estado, por lo que dice (los textos salen del servidor, en castellano). */
export function tonoDe(texto: string): Tono {
  const t = texto.toLowerCase();
  if (/^(completada|recibida|se ve|publicada|compra|ajuste \(\+\)|devoluci)/.test(t)) return "exito";
  if (/^(cancelada|merma|ajuste \(−\)|ajuste \(-\))/.test(t)) return "error";
  if (/^(pendiente|por confirmar|oculta)/.test(t)) return "aviso";
  if (/^(destacada|en vivo|una persona|vos)/.test(t)) return "info";
  if (/^(cliente|la ia|ia|preparando)$/.test(t) || /^(cliente|la ia|preparando)/.test(t)) return "neutro";
  if (/^(en proceso|en camino|venta)/.test(t)) return "info";
  return "neutro";
}

/**
 * Por qué orden se ordena al tocar una columna: la clave del orden si la
 * columna lo es ("total"), o el nombre ("producto", "cliente" → "nombre").
 * null si esa columna no ordena.
 */
export function ordenDeColumna(clave: string, ordenes: Record<string, string>): string | null {
  if (ordenes[clave]) return clave;
  if (["producto", "cliente", "categoria", "marca"].includes(clave) && ordenes.nombre) return "nombre";
  return null;
}

/** Tocar la columna por la que ya se ordena da vuelta el sentido; otra, empieza por lo más grande (o la A). */
export function siguienteOrden(actual: ConsultaRecurso["orden"], campo: string): ConsultaRecurso["orden"] {
  if (actual.campo === campo) return { campo, sentido: actual.sentido === "asc" ? "desc" : "asc" };
  return { campo, sentido: campo === "nombre" || campo === "proveedor" ? "asc" : "desc" };
}

/** Sacar un chip: el de las fechas saca el rango entero (igual que el servidor). */
export function sinFiltro(filtros: Record<string, ValorFiltro>, clave: string): Record<string, ValorFiltro> {
  const resto = { ...filtros };
  if (clave === "fechas") {
    delete resto.desde;
    delete resto.hasta;
  } else delete resto[clave];
  return resto;
}

/** "625 ventas · Bs 165.178,00" para la cabecera de la lista. */
export function resumenLista(l: Pick<ListaRecurso, "resumen" | "titulo" | "singular">): string {
  const plata = l.resumen.suma != null && l.resumen.suma > 0 ? ` · Bs ${dosDecimales.format(l.resumen.suma)}` : "";
  return `${entero.format(l.resumen.total)} ${l.resumen.total === 1 ? l.singular : l.titulo.toLowerCase()}${plata}`;
}

/** La lista a Excel: las columnas que se ven, con los números como números. */
export function hojaDeLista(l: Pick<ListaRecurso, "titulo" | "columnas" | "filas">): HojaExcel {
  return {
    nombre: l.titulo,
    columnas: l.columnas.map((c) => ({
      titulo: c.etiqueta,
      tipo: c.formato === "dinero" ? "dinero" : c.formato === "numero" || c.formato === "porcentaje" ? "numero" : "texto",
    })),
    filas: l.filas.map((f) =>
      l.columnas.map((c) => {
        const v = f[c.clave];
        if (v === null || v === undefined || v === "") return null;
        if (c.formato === "dinero" || c.formato === "numero" || c.formato === "porcentaje") {
          const n = Number(v);
          return Number.isFinite(n) ? n : String(v);
        }
        return c.formato === "fecha" ? fechaCorta(String(v)) : String(v);
      }),
    ),
  };
}
