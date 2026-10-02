import type { Condicion, Filtros, Periodo, PiezaVista, ProductoOpcion, TablaVista, TipoColumna, TipoFiltro, VistaSpec } from "@/entities/omnibox/model/types";

import type { AccionMesa } from "./mesa";

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
      return typeof periodo === "string" && periodo.startsWith("mes:") ? "vs. el mes anterior" : "vs. el período anterior";
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

// ------------------------------------------------------------ alcance (G6b)

export const ETIQUETA_FILTRO: Record<TipoFiltro, string> = { cliente: "Cliente", producto: "Producto", categoria: "Categoría" };
const TIPOS_FILTRO: TipoFiltro[] = ["cliente", "producto", "categoria"];

/** Los filtros de una vista, en orden, para mostrarlos como chips. */
export function filtrosDe(f: Filtros | undefined): { tipo: TipoFiltro; etiqueta: string; nombre: string }[] {
  return TIPOS_FILTRO.filter((t) => f?.[t]).map((t) => ({ tipo: t, etiqueta: ETIQUETA_FILTRO[t], nombre: f![t]!.nombre }));
}

const DIA: Record<string, string> = {
  lunes: "Los lunes", martes: "Los martes", miercoles: "Los miércoles", jueves: "Los jueves",
  viernes: "Los viernes", sabado: "Los sábados", domingo: "Los domingos",
};

/** "Ventas de más de Bs 500", "Pagadas con tarjeta", "Los sábados", "Desde las 18:00" (igual que el servidor). */
export function textoCondicion(c: Condicion): string {
  const bs = (n: number) => `Bs ${n.toLocaleString("es-BO", { maximumFractionDigits: 2 })}`;
  const n = Number(c.valor);
  switch (c.campo) {
    case "monto":
      return ({ ">": `Ventas de más de ${bs(n)}`, ">=": `Ventas desde ${bs(n)}`, "<": `Ventas de menos de ${bs(n)}`, "<=": `Ventas hasta ${bs(n)}` } as Record<string, string>)[c.op] ?? "";
    case "pago":
      return `${c.op === "!=" ? "No pagadas" : "Pagadas"} con ${c.valor === "qr" ? "QR" : c.valor}`;
    case "dia_semana":
      return c.op === "!=" ? `Menos ${(DIA[String(c.valor)] ?? "").toLowerCase()}` : (DIA[String(c.valor)] ?? String(c.valor));
    case "hora":
      return ({ ">": `Después de las ${n}:00`, ">=": `Desde las ${n}:00`, "<": `Antes de las ${n}:00`, "<=": `Hasta las ${n}:00` } as Record<string, string>)[c.op] ?? "";
    default:
      return "";
  }
}

/**
 * De quién son los números, en una línea: "Cliente: José Luis Mamani · Pagadas
 * con tarjeta". Sin filtros, "Toda la tienda": que nunca haya que adivinar si
 * es de José o de todos.
 */
export function textoAlcance(f: Filtros | undefined, condiciones: Condicion[] = []): string {
  const lista = filtrosDe(f).map((x) => `${x.etiqueta}: ${x.nombre}`);
  const conds = condiciones.map(textoCondicion);
  return [...(lista.length ? lista : ["Toda la tienda"]), ...conds].join(" · ");
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
      case "comparativa":
        return "Comparativa";
      case "alerta":
        return "Alerta";
      case "accion":
        return "Reponer";
      case "conclusion":
        return "Conclusión";
    }
  });
}

// ============================================================ G4

const NOMBRES_MES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** "Últimos 30 días"; un mes con nombre, "Agosto" (este año) o "Agosto de 2025". */
export function etiquetaPeriodo(p: Periodo, ahora = new Date()): string {
  const m = /^mes:(\d{4})-(\d{2})$/.exec(p);
  if (m) {
    const nombre = NOMBRES_MES[Number(m[2]) - 1] ?? p;
    return Number(m[1]) === ahora.getFullYear() ? nombre : `${nombre} de ${m[1]}`;
  }
  return PERIODOS.find((x) => x.id === p)?.etiqueta ?? p;
}

/**
 * Lo que ofrece el selector de período: los de siempre y, si la vista mira
 * un mes con nombre ("agosto"), ese mes también, para que se vea elegido.
 */
export function opcionesPeriodo(actual: Periodo | null): { id: Periodo; etiqueta: string }[] {
  return actual && !PERIODOS.some((p) => p.id === actual) ? [{ id: actual, etiqueta: etiquetaPeriodo(actual) }, ...PERIODOS] : PERIODOS;
}

// ------------------------------------------------------------ productos de una fila

/**
 * El producto de una fila (stock bajo, más vendidos, margen): viene oculto en
 * las claves "_" para poder cargarlo a la compra o abrir su ficha sin otra
 * búsqueda. Sin ids no es un producto que se pueda tocar.
 */
export function productoDeFila(fila: Record<string, unknown>, nombre = "producto"): ProductoOpcion | null {
  if (typeof fila._productId !== "string" || typeof fila._storeProductId !== "string") return null;
  return {
    productId: fila._productId,
    storeProductId: fila._storeProductId,
    nombre: String(fila[nombre] ?? ""),
    codigo: null,
    imagen: typeof fila._imagen === "string" ? fila._imagen : null,
    precio: Number(fila._precio) || 0,
    stock: Number(fila._stock) || 0,
    similitud: 1,
  };
}

export interface Reposicion {
  producto: ProductoOpcion;
  cantidad: number;
  /** El último costo pagado (o el promedio). null = no se sabe: la Guía lo avisa en la compra. */
  costo: number | null;
}

export function paraReponer(filas: Record<string, unknown>[]): Reposicion[] {
  return filas.flatMap((f) => {
    const producto = productoDeFila(f);
    if (!producto) return [];
    const costo = f._costo == null ? null : Number(f._costo);
    return [
      {
        producto,
        cantidad: Math.max(1, Math.floor(Number(f._sugerido) || 1)),
        costo: costo != null && Number.isFinite(costo) ? costo : null,
      },
    ];
  });
}

/**
 * "Reponer estos 3" (el puente a N1): lo mismo que cargar cada producto a la
 * compra a mano, y la compra abierta para revisarla. No registra nada.
 */
export function accionesReponer(items: Reposicion[]): AccionMesa[] {
  if (items.length === 0) return [];
  return [
    ...items.map(
      (it): AccionMesa => ({
        tipo: "agregarCompra",
        producto: it.producto,
        cantidad: it.cantidad,
        costo: it.costo ?? 0,
        costoAnterior: it.costo,
      }),
    ),
    { tipo: "abrir", mesa: "compra", pestana: "borrador" },
  ];
}

// ------------------------------------------------------------ alertas

/** Los umbrales de las alertas: fijos y a la vista, no los decide el modelo. */
export const UMBRALES_ALERTA = { diasStock: 7, margenMinimo: 15, cambioVentas: 10 };

export interface Alerta {
  nivel: "advertencia" | "bien";
  texto: string;
  detalle?: string;
}

const nombres = (filas: Record<string, unknown>[], clave = "producto") => {
  const n = filas.map((f) => String(f[clave] ?? "")).filter(Boolean);
  return n.length > 3 ? `${n.slice(0, 3).join(", ")} y ${n.length - 3} más` : n.join(", ");
};

/**
 * El hallazgo de una alerta. Regla fija por fuente y números de los datos:
 * la IA eligió mostrarla, pero lo que dice no lo redacta ella.
 */
export function alertaDe(fuente: string, tabla: TablaVista): Alerta | null {
  const filas = tabla.filas;
  const u = UMBRALES_ALERTA;
  switch (fuente) {
    case "stock_bajo": {
      const urgentes = filas.filter((f) => num(f.stock) <= 0 || (f.dias != null && num(f.dias) <= u.diasStock));
      if (urgentes.length > 0) {
        const n = urgentes.length;
        return {
          nivel: "advertencia",
          texto: n === 1 ? "1 producto se acaba esta semana" : `${n} productos se acaban esta semana`,
          detalle: nombres(urgentes),
        };
      }
      return filas.length > 0
        ? { nivel: "bien", texto: "Nada se acaba esta semana", detalle: `${filas.length} con poco stock: ${nombres(filas)}` }
        : { nivel: "bien", texto: "Ningún producto tiene poco stock" };
    }
    case "margen_por_producto": {
      const conCosto = filas.filter((f) => f.margen != null);
      if (filas.length > 0 && conCosto.length === 0) {
        return {
          nivel: "advertencia",
          texto: "No se puede saber cuánto dejan: faltan los costos",
          detalle: "Se cargan solos al registrar las compras.",
        };
      }
      const bajos = conCosto.filter((f) => num(f.margen) < u.margenMinimo);
      if (bajos.length > 0) {
        const n = bajos.length;
        return {
          nivel: "advertencia",
          texto: `${n === 1 ? "1 producto deja" : `${n} productos dejan`} menos de ${u.margenMinimo} % de margen`,
          detalle: nombres(bajos),
        };
      }
      return conCosto.length > 0 ? { nivel: "bien", texto: `Todo lo vendido deja al menos ${u.margenMinimo} % de margen` } : null;
    }
    case "sin_ventas": {
      const quietos = filas.filter((f) => num(f.vendidas) === 0);
      if (quietos.length === 0) {
        return filas.length > 0
          ? { nivel: "bien", texto: "Todo lo que tenés en stock se vendió en este período" }
          : { nivel: "bien", texto: "No hay productos con stock para revisar" };
      }
      const parado = quietos.reduce((s, f) => s + (f.parado == null ? 0 : num(f.parado)), 0);
      const n = quietos.length;
      return {
        nivel: "advertencia",
        texto: `${n === 1 ? "1 producto no se vendió" : `${n} productos no se vendieron`} en este período${
          parado > 0 ? ` · Bs ${parado.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} parados` : ""
        }`,
        detalle: nombres(quietos),
      };
    }
    case "kpis": {
      const ventas = filas.find((f) => f.indicador === "Ventas");
      if (!ventas) return null;
      if (num(ventas.valor) === 0 && num(ventas.anterior) === 0) {
        return { nivel: "advertencia", texto: "No hubo ventas en este período ni en el anterior" };
      }
      const v = variacion(ventas.valor, ventas.anterior);
      if (!v) return { nivel: "bien", texto: "Hay ventas y el período anterior no tuvo: no hay con qué comparar" };
      const pct = Math.abs(v.pct).toLocaleString("es-BO", { maximumFractionDigits: 1 });
      if (v.pct <= -u.cambioVentas) return { nivel: "advertencia", texto: `Las ventas bajaron ${pct} % contra el período anterior` };
      if (v.pct >= u.cambioVentas) return { nivel: "bien", texto: `Las ventas subieron ${pct} % contra el período anterior` };
      return { nivel: "bien", texto: "Las ventas se mantienen parecidas al período anterior" };
    }
    default:
      return null;
  }
}

// ------------------------------------------------------------ comparativa

export interface FilaComparada {
  etiqueta: string;
  a: number;
  b: number;
  /** a − b: lo que cambió del segundo período al primero. */
  diferencia: number;
  /** Sobre b, con un decimal. null si b es cero (no hay con qué comparar). */
  pct: number | null;
}

/**
 * Un período contra otro, fila por fila. Lo que aparece en uno solo cuenta
 * como cero en el otro (una categoría que este mes no vendió nada).
 */
export function comparar(
  filasA: Record<string, unknown>[],
  filasB: Record<string, unknown>[],
  etiqueta: string,
  valor: string,
): FilaComparada[] {
  const mapa = (filas: Record<string, unknown>[]) => {
    const m = new Map<string, number>();
    for (const f of filas) {
      const k = String(f[etiqueta] ?? "—");
      const v = num(f[valor]);
      m.set(k, (m.get(k) ?? 0) + (Number.isFinite(v) ? v : 0));
    }
    return m;
  };
  const A = mapa(filasA);
  const B = mapa(filasB);
  const claves = [...new Set([...A.keys(), ...B.keys()])];
  return claves
    .map((k) => {
      const a = A.get(k) ?? 0;
      const b = B.get(k) ?? 0;
      return {
        etiqueta: k,
        a,
        b,
        diferencia: Math.round((a - b) * 100) / 100,
        pct: b !== 0 ? Math.round(((a - b) / Math.abs(b)) * 1000) / 10 : null,
      };
    })
    .sort((x, y) => Math.max(y.a, y.b) - Math.max(x.a, x.b));
}

// ------------------------------------------------------------ misma vista

/** JSON con las claves ordenadas: dos vistas iguales dan el mismo texto aunque el orden de las claves cambie. */
function canonico(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonico).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonico((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

/** ¿Es la misma vista? Para saber si la que está en pantalla ya está fijada. */
export function mismaVista(a: VistaSpec, b: VistaSpec): boolean {
  return canonico(a.piezas) === canonico(b.piezas);
}

// ------------------------------------------------------------ qué cambió

const identidad = (p: PiezaVista) =>
  p.tipo === "conclusion"
    ? "conclusion"
    : [p.tipo, p.fuente, "x" in p ? p.x : "", "etiqueta" in p ? p.etiqueta : "", "accion" in p ? p.accion : ""].join("|");

const nombrePieza = (p: PiezaVista) =>
  ("titulo" in p && p.titulo) || resumenPiezas({ titulo: "", piezas: [p] })[0].toLowerCase();

const NOMBRE_FORMA_CORTO: Record<string, string> = { barras: "barras", lineas: "líneas", area: "área", torta: "torta" };

/**
 * Lo que cambió entre dos versiones de una vista, para la tarjeta del chat
 * ("Agregué: Por categoría · Período: Este mes"). Se calcula, no lo dice el
 * modelo: así nunca anuncia un cambio que no hizo.
 */
export function diferenciasVista(antes: VistaSpec, despues: VistaSpec): string[] {
  const cambios: string[] = [];
  const previas = new Map(antes.piezas.map((p) => [identidad(p), p]));
  const nuevas = new Map(despues.piezas.map((p) => [identidad(p), p]));
  for (const [k, p] of previas) if (!nuevas.has(k)) cambios.push(`Saqué: ${nombrePieza(p)}`);
  for (const [k, p] of nuevas) if (!previas.has(k)) cambios.push(`Agregué: ${nombrePieza(p)}`);

  let periodo: Periodo | null = null;
  for (const [k, p] of nuevas) {
    const q = previas.get(k);
    if (!q || p.tipo === "conclusion" || q.tipo === "conclusion") continue;
    const { periodo: pa, ...restoA } = q.params;
    const { periodo: pb, ...restoB } = p.params;
    if (pa !== pb && pb) periodo = pb as Periodo;
    const sinParams = (x: PiezaVista) => JSON.stringify({ ...x, id: "", params: {}, titulo: "" });
    if (JSON.stringify(restoA) !== JSON.stringify(restoB) || sinParams(p) !== sinParams(q)) {
      cambios.push(
        p.tipo === "grafico" && q.tipo === "grafico" && p.forma !== q.forma
          ? `Ahora en ${NOMBRE_FORMA_CORTO[p.forma] ?? p.forma}: ${nombrePieza(p)}`
          : `Cambié: ${nombrePieza(p)}`,
      );
    }
  }
  if (periodo) cambios.push(`Período: ${etiquetaPeriodo(periodo)}`);
  if (textoAlcance(antes.filtros, antes.condiciones) !== textoAlcance(despues.filtros, despues.condiciones)) {
    cambios.push(`Ahora: ${textoAlcance(despues.filtros, despues.condiciones)}`);
  }
  return cambios;
}
