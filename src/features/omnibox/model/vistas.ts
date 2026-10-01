import type { Periodo, PiezaVista, TipoColumna, VistaSpec } from "@/entities/omnibox/model/types";

/**
 * Las vistas que arma la IA (Fase G3, nivel N2), del lado de la pantalla.
 *
 * El servidor ya validó la vista y calcula cada número; acá solo se decide
 * cómo se LEE: el formato de cada valor, la variación contra el período
 * anterior, qué se pliega en "Otros". Funciones puras, sin React, para
 * probarlas sin navegador.
 */

// ------------------------------------------------------------ períodos

export const PERIODOS: { id: Periodo; etiqueta: string }[] = [
  { id: "hoy", etiqueta: "Hoy" },
  { id: "ayer", etiqueta: "Ayer" },
  { id: "7dias", etiqueta: "Últimos 7 días" },
  { id: "30dias", etiqueta: "Últimos 30 días" },
  { id: "90dias", etiqueta: "Últimos 90 días" },
  { id: "este_mes", etiqueta: "Este mes" },
  { id: "mes_pasado", etiqueta: "El mes pasado" },
  { id: "este_anio", etiqueta: "Este año" },
];

/** "vs. los 7 días anteriores": contra qué compara la variación de un indicador. */
export function contraQue(periodo: unknown): string {
  switch (periodo) {
    case "hoy":
      return "vs. ayer";
    case "ayer":
      return "vs. el día anterior";
    case "7dias":
      return "vs. los 7 días anteriores";
    case "30dias":
      return "vs. los 30 días anteriores";
    case "90dias":
      return "vs. los 90 días anteriores";
    case "este_mes":
      return "vs. el mes pasado";
    case "mes_pasado":
      return "vs. el mes anterior";
    case "este_anio":
      return "vs. el año pasado";
    default:
      return "vs. el período anterior";
  }
}

const tienePeriodo = (p: PiezaVista): p is Exclude<PiezaVista, { tipo: "conclusion" }> =>
  p.tipo !== "conclusion" && "periodo" in p.params;

/**
 * El período de la vista, si todas las piezas miran el mismo. Con piezas en
 * períodos distintos ("este mes contra el pasado") no hay uno solo que
 * cambiar, y el selector no se muestra.
 */
export function periodoComun(vista: VistaSpec): Periodo | null {
  const periodos = new Set(vista.piezas.filter(tienePeriodo).map((p) => p.params.periodo));
  return periodos.size === 1 ? ([...periodos][0] as Periodo) : null;
}

/** La misma vista en otro período: el filtro de arriba cambia todas las piezas a la vez. */
export function conPeriodo(vista: VistaSpec, periodo: Periodo): VistaSpec {
  return {
    ...vista,
    piezas: vista.piezas.map((p) => (tienePeriodo(p) ? { ...p, params: { ...p.params, periodo } } : p)),
  };
}

// ------------------------------------------------------------ formato

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const num = (v: unknown): number => (typeof v === "number" ? v : Number(v));

/**
 * "2026-09-25" → "25 sep"; por mes, "sep". Se parte el texto y no se pasa por
 * `new Date`: "2026-09-25" es medianoche UTC, que en Bolivia es el 24.
 */
export function etiquetaFecha(iso: string, agrupar: unknown = "dia", conAnio = false): string {
  const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!a || !m) return String(iso);
  const mes = MESES[m - 1];
  if (agrupar === "mes") return conAnio ? `${mes} ${a}` : mes;
  return conAnio ? `${d} ${mes} ${a}` : `${d} ${mes}`;
}

/** Un valor como se lee en una tabla o en un tooltip: "Bs 1.234,50", "33,3 %", "12". */
export function valorConFormato(v: unknown, tipo: TipoColumna, agrupar?: unknown): string {
  if (v == null || v === "") return "—";
  switch (tipo) {
    case "dinero":
      return `Bs ${num(v).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case "numero":
      return num(v).toLocaleString("es-BO", { maximumFractionDigits: 2 });
    case "porcentaje":
      return `${num(v).toLocaleString("es-BO", { maximumFractionDigits: 1 })} %`;
    case "fecha":
      return etiquetaFecha(String(v), agrupar, true);
    default:
      return String(v);
  }
}

/** Para los ejes: "Bs 1,2 mil", "15 mil", "1,5 M". Los ejes no necesitan centavos. */
export function compacto(v: unknown, tipo: TipoColumna): string {
  const n = num(v);
  const abs = Math.abs(n);
  const corto =
    abs >= 1_000_000
      ? `${(n / 1_000_000).toLocaleString("es-BO", { maximumFractionDigits: 1 })} M`
      : abs >= 1_000
        ? `${(n / 1_000).toLocaleString("es-BO", { maximumFractionDigits: 1 })} mil`
        : n.toLocaleString("es-BO", { maximumFractionDigits: 1 });
  if (tipo === "dinero") return `Bs ${corto}`;
  if (tipo === "porcentaje") return `${corto} %`;
  return corto;
}

// ------------------------------------------------------------ indicadores

export interface Variacion {
  /** Con un decimal: 24,6. */
  pct: number;
  direccion: "sube" | "baja" | "igual";
}

/**
 * Cuánto cambió contra el período anterior. Sin período anterior (cero) no
 * hay porcentaje que decir: "+∞ %" no le sirve a nadie.
 */
export function variacion(valor: unknown, anterior: unknown): Variacion | null {
  const v = num(valor);
  const a = num(anterior);
  if (!Number.isFinite(v) || !Number.isFinite(a) || a === 0) return null;
  const pct = Math.round(((v - a) / Math.abs(a)) * 1000) / 10;
  return { pct, direccion: pct > 0 ? "sube" : pct < 0 ? "baja" : "igual" };
}

// ------------------------------------------------------------ gráficos

/** Una torta se lee con pocas porciones: más de seis y el resto va a "Otros". */
export const MAX_PORCIONES = 6;

export interface Porcion {
  nombre: string;
  valor: number;
  /** Sobre el total, con un decimal. */
  parte: number;
  otros?: boolean;
}

/**
 * Las porciones de una torta, de mayor a menor, con la cola plegada en
 * "Otros". Lo que es cero o negativo no tiene porción.
 */
export function porciones(filas: Record<string, unknown>[], x: string, y: string, max = MAX_PORCIONES): Porcion[] {
  const positivas = filas
    .map((f) => ({ nombre: String(f[x] ?? "—"), valor: num(f[y]) }))
    .filter((p) => Number.isFinite(p.valor) && p.valor > 0)
    .sort((a, b) => b.valor - a.valor);
  const total = positivas.reduce((s, p) => s + p.valor, 0);
  const visibles =
    positivas.length > max
      ? [
          ...positivas.slice(0, max - 1),
          { nombre: "Otros", valor: positivas.slice(max - 1).reduce((s, p) => s + p.valor, 0), otros: true },
        ]
      : positivas;
  return visibles.map((p) => ({ ...p, parte: total > 0 ? Math.round((p.valor / total) * 1000) / 10 : 0 }));
}

/** Un gráfico de barras sobre fechas u horas va en columnas; sobre nombres, acostado. */
export function barrasAcostadas(tipoX: TipoColumna): boolean {
  return tipoX !== "fecha" && tipoX !== "hora";
}

/** ¿Hay algo que dibujar? Una serie toda en cero es "no hubo ventas", no un gráfico plano. */
export function hayDatos(filas: Record<string, unknown>[], ys: string[]): boolean {
  return filas.some((f) => ys.some((y) => num(f[y]) !== 0 && Number.isFinite(num(f[y]))));
}

// ------------------------------------------------------------ ranking

export interface Puesto {
  etiqueta: string;
  valor: number;
  /** Contra el primero: la barra del primero va llena. */
  proporcion: number;
  imagen: string | null;
}

export function puestos(filas: Record<string, unknown>[], etiqueta: string, valor: string, limite = 10): Puesto[] {
  const ordenados = filas
    .map((f) => ({
      etiqueta: String(f[etiqueta] ?? "—"),
      valor: num(f[valor]),
      imagen: typeof f._imagen === "string" ? f._imagen : null,
    }))
    .filter((p) => Number.isFinite(p.valor))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, limite);
  const tope = Math.max(...ordenados.map((p) => p.valor), 0);
  return ordenados.map((p) => ({ ...p, proporcion: tope > 0 ? Math.max(0, p.valor / tope) : 0 }));
}

// ------------------------------------------------------------ la tarjeta del chat

const NOMBRE_FORMA: Record<string, string> = {
  barras: "Gráfico de barras",
  lineas: "Gráfico de líneas",
  area: "Gráfico de área",
  torta: "Gráfico de torta",
};

/** "Indicadores · Gráfico de barras · Ranking · Conclusión": qué trae la vista. */
export function resumenPiezas(vista: VistaSpec): string[] {
  return vista.piezas.map((p) => {
    switch (p.tipo) {
      case "indicadores":
        return "Indicadores";
      case "grafico":
        return NOMBRE_FORMA[p.forma] ?? "Gráfico";
      case "ranking":
        return "Ranking";
      case "tabla":
        return "Tabla";
      case "conclusion":
        return "Conclusión";
    }
  });
}
