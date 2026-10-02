import { useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCircle2,
  Inbox,
  Minus,
  RotateCcw,
  Sparkles,
  Table2,
  Truck,
} from "lucide-react";

import { useConclusionVista, useFuenteVista } from "@/entities/omnibox/api";
import type { ColumnaVista, PiezaVista, ProductoOpcion, TablaVista, TipoColumna, VistaSpec } from "@/entities/omnibox/model/types";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/cn";

import {
  alertaDe,
  barrasAcostadas,
  comparar,
  compacto,
  contraQue,
  etiquetaFecha,
  etiquetaPeriodo,
  hayDatos,
  paraReponer,
  porciones,
  productoDeFila,
  puestos,
  valorConFormato,
  variacion,
} from "../../model/vistas";
import { BotonCta, BotonSecundario, FotoProducto, dinero } from "../piezas";
import { useAccionesVista } from "./acciones";

/**
 * Las piezas de una vista (G3): indicadores, gráfico, ranking, tabla y
 * conclusión. La IA eligió cuáles y de qué fuente lee cada una; acá se
 * dibujan con reglas fijas, las mismas para cualquier vista:
 *
 * - Marcas finas (barras de 24 px como mucho, líneas de 2 px), grilla en
 *   línea fina y apagada, un solo eje.
 * - Una serie, un color. Varias series, los colores de la paleta en orden
 *   fijo (`--viz-1…6`, validada para daltonismo) y siempre con leyenda.
 * - El texto nunca va del color de la serie: los valores y etiquetas usan
 *   la tinta de siempre, el color va en la marca de al lado.
 * - Todo gráfico tiene su tabla: el tooltip ayuda, no es la única forma de
 *   leer un número.
 */

/** Las piezas que leen UNA fuente. La comparativa (dos lecturas) y la alerta tienen su componente. */
type PiezaDatos = Extract<PiezaVista, { tipo: "indicadores" | "grafico" | "tabla" | "ranking" | "accion" }>;

const reducido = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const serie = (i: number) => `var(--viz-${(i % 6) + 1})`;

/** Lo que dice una pieza vacía. "No hubo ventas" es un dato, no un error. */
const VACIO: Record<string, string> = {
  stock_bajo: "Ningún producto se está por acabar.",
  clientes_frecuentes: "No hay ventas con cliente en este período.",
  compras_por_proveedor: "No hay compras en este período.",
  margen_por_producto: "No hay ventas con costo cargado en este período.",
  sin_ventas: "No hay productos con stock para revisar.",
};

// ------------------------------------------------------------ el marco

function Marco({
  pieza,
  titulo,
  periodo,
  refrescando = false,
  tabla,
  onTabla,
  children,
}: {
  pieza: PiezaVista;
  titulo: string;
  periodo?: string;
  /** Llegan datos nuevos (cambió el período): se queda lo anterior, atenuado. */
  refrescando?: boolean;
  /** Solo los gráficos y rankings: alternar con su tabla. */
  tabla?: boolean;
  onTabla?: () => void;
  children: ReactNode;
}) {
  return (
    <section
      data-testid="vista-pieza"
      data-tipo={pieza.tipo}
      data-fuente={"fuente" in pieza ? pieza.fuente : undefined}
      aria-label={titulo}
      className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-card"
    >
      <header className="mb-3 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-tight text-foreground">{titulo}</h3>
          {periodo ? <p className="mt-0.5 text-xs text-muted-foreground">{periodo}</p> : null}
        </div>
        {onTabla ? (
          <button
            type="button"
            onClick={onTabla}
            aria-pressed={tabla}
            aria-label={tabla ? "Ver el gráfico" : "Ver la tabla"}
            title={tabla ? "Ver el gráfico" : "Ver la tabla"}
            data-testid="vista-alternar"
            data-no-imprimir
            className="grid size-8 shrink-0 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-border-strong hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {tabla ? <BarChart3 className="size-4" /> : <Table2 className="size-4" />}
          </button>
        ) : null}
      </header>
      <div className={cn("transition-opacity duration-200", refrescando && "opacity-50")}>{children}</div>
    </section>
  );
}

function Vacio({ children }: { children: ReactNode }) {
  return (
    <div data-testid="vista-vacia" className="flex items-center gap-2.5 rounded-lg bg-muted/60 px-3 py-4 text-[13px] text-muted-foreground">
      <Inbox className="size-4 shrink-0" />
      {children}
    </div>
  );
}

/**
 * Una pieza con datos: pide su fuente y la dibuja apenas llega, sin esperar
 * a las demás. El error de una pieza no tumba la vista.
 */
export function PiezaConDatos({ pieza, storeId }: { pieza: PiezaDatos; storeId: string }) {
  const consulta = useFuenteVista(storeId, pieza.fuente, pieza.params);
  const [verTabla, setVerTabla] = useState(false);
  const titulo = pieza.titulo ?? (pieza.tipo === "indicadores" ? "Indicadores" : "");
  const alternable = pieza.tipo === "grafico" || pieza.tipo === "ranking";

  if (consulta.isLoading) {
    return (
      <Marco pieza={pieza} titulo={titulo}>
        <div aria-busy className="space-y-2" data-testid="vista-cargando">
          <span className="sr-only">Cargando…</span>
          {pieza.tipo === "indicadores" ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[76px] rounded-lg" />
              ))}
            </div>
          ) : (
            <Skeleton className="h-[180px] rounded-lg" />
          )}
        </div>
      </Marco>
    );
  }

  if (consulta.isError || !consulta.data) {
    return (
      <Marco pieza={pieza} titulo={titulo}>
        <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
          <AlertCircle className="size-4 shrink-0 text-destructive" />
          <span className="flex-1">{(consulta.error as Error | null)?.message ?? "No pude leer estos datos."}</span>
          <button
            type="button"
            onClick={() => consulta.refetch()}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
          >
            <RotateCcw className="size-3.5" />
            Reintentar
          </button>
        </div>
      </Marco>
    );
  }

  const tabla = consulta.data;
  const refrescando = consulta.isPlaceholderData && consulta.isFetching;
  const ys = pieza.tipo === "grafico" ? pieza.y : pieza.tipo === "ranking" ? [pieza.valor] : null;
  const vacia = tabla.filas.length === 0 || (ys !== null && !hayDatos(tabla.filas, ys));

  return (
    <Marco
      pieza={pieza}
      titulo={titulo}
      periodo={tabla.periodo}
      refrescando={refrescando}
      tabla={verTabla}
      onTabla={alternable && !vacia ? () => setVerTabla((v) => !v) : undefined}
    >
      {vacia ? (
        <Vacio>{pieza.tipo === "accion" ? "No hay nada para reponer." : (VACIO[pieza.fuente] ?? "No hubo ventas en este período.")}</Vacio>
      ) : verTabla || pieza.tipo === "tabla" ? (
        <TablaDatos
          tabla={tabla}
          columnas={
            pieza.tipo === "tabla"
              ? pieza.columnas
              : pieza.tipo === "grafico"
                ? [pieza.x, ...pieza.y]
                : pieza.tipo === "ranking"
                  ? [pieza.etiqueta, pieza.valor]
                  : undefined
          }
          agrupar={pieza.params.agrupar}
        />
      ) : pieza.tipo === "indicadores" ? (
        <Indicadores tabla={tabla} periodo={pieza.params.periodo} />
      ) : pieza.tipo === "grafico" ? (
        <Grafico pieza={pieza} tabla={tabla} />
      ) : pieza.tipo === "accion" ? (
        <Reponer tabla={tabla} />
      ) : (
        <Ranking pieza={pieza as Extract<PiezaDatos, { tipo: "ranking" }>} tabla={tabla} />
      )}
    </Marco>
  );
}

// ------------------------------------------------------------ indicadores

/**
 * Una fila de indicadores: el valor grande y, debajo, cuánto cambió contra
 * el período anterior. El margen se compara en puntos ("+3,2 pts"), no en
 * porcentaje de un porcentaje.
 */
function Indicadores({ tabla, periodo }: { tabla: TablaVista; periodo: unknown }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]">
      {tabla.filas.map((f) => {
        const formato = (f.formato as TipoColumna) ?? "numero";
        const enPuntos = formato === "porcentaje";
        const v = variacion(f.valor, f.anterior);
        const diferencia = enPuntos && v ? Math.round((Number(f.valor) - Number(f.anterior)) * 10) / 10 : null;
        const cifra = diferencia ?? v?.pct ?? 0;
        return (
          <div
            key={String(f.indicador)}
            data-testid="vista-indicador"
            data-indicador={String(f.indicador)}
            className="min-w-0 rounded-lg bg-muted/60 px-3 py-2.5"
          >
            <p className="truncate text-xs text-muted-foreground">{String(f.indicador)}</p>
            <p className="mt-0.5 truncate text-lg font-semibold tracking-tight text-foreground">
              {valorConFormato(f.valor, formato)}
            </p>
            {v ? (
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[11px] leading-tight">
                <span
                  data-testid="vista-variacion"
                  className={cn(
                    "inline-flex items-center gap-0.5 font-semibold",
                    v.direccion === "sube" && "text-success-soft-foreground",
                    v.direccion === "baja" && "text-destructive-soft-foreground",
                    v.direccion === "igual" && "text-muted-foreground",
                  )}
                >
                  {v.direccion === "sube" ? (
                    <ArrowUpRight className="size-3" aria-label="subió" />
                  ) : v.direccion === "baja" ? (
                    <ArrowDownRight className="size-3" aria-label="bajó" />
                  ) : (
                    <Minus className="size-3" aria-label="igual" />
                  )}
                  {cifra > 0 ? "+" : ""}
                  {cifra.toLocaleString("es-BO", { maximumFractionDigits: 1 })}
                  {enPuntos ? " pts" : " %"}
                </span>
                <span className="text-muted-foreground">{contraQue(periodo)}</span>
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">Sin datos para comparar</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------ gráfico

const EJE = {
  tick: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
  axisLine: false,
  tickLine: false,
} as const;

const truncar = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function Grafico({ pieza, tabla }: { pieza: Extract<PiezaDatos, { tipo: "grafico" }>; tabla: TablaVista }) {
  const columna = (clave: string) => tabla.columnas.find((c) => c.clave === clave);
  const colX = columna(pieza.x);
  const colsY = pieza.y.map(columna).filter(Boolean) as ColumnaVista[];
  if (!colX || colsY.length === 0) return <Vacio>Esta pieza no se puede dibujar.</Vacio>;

  const tipoY = colsY[0].tipo;
  const agrupar = pieza.params.agrupar;
  const datos = tabla.filas.map((f) => ({
    ...f,
    _x: colX.tipo === "fecha" ? etiquetaFecha(String(f[pieza.x]), agrupar) : String(f[pieza.x] ?? "—"),
  }));
  const animar = !reducido();
  const varias = colsY.length > 1;
  const tip = (props: any) => <Tip {...props} tipoY={tipoY} colX={colX} agrupar={agrupar} varias={varias} />;

  if (pieza.forma === "torta") return <Torta filas={tabla.filas} x={pieza.x} y={colsY[0]} />;

  const leyenda = varias ? <Leyenda series={colsY} linea={pieza.forma === "lineas"} /> : null;

  if (pieza.forma === "barras" && barrasAcostadas(colX.tipo)) {
    // Nombres largos (productos, categorías): barras acostadas, el valor en la punta.
    const alto = Math.max(96, datos.length * (varias ? 14 * colsY.length + 14 : 30) + 8);
    return (
      <div>
        {leyenda}
        <div style={{ height: alto }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos} layout="vertical" margin={{ top: 0, right: 72, bottom: 0, left: 0 }} barGap={2}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="_x"
                width={150}
                {...EJE}
                tickFormatter={(v: string) => truncar(String(v), 22)}
              />
              <Tooltip content={tip} cursor={{ fill: "hsl(var(--muted))" }} />
              {colsY.map((c, i) => (
                <Bar
                  key={c.clave}
                  dataKey={c.clave}
                  name={c.titulo}
                  fill={serie(i)}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={varias ? 12 : 18}
                  isAnimationActive={animar}
                >
                  {!varias && (
                    <LabelList
                      dataKey={c.clave}
                      position="right"
                      formatter={(v: unknown) => compacto(v, tipoY)}
                      style={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                  )}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  const ejes = (
    <>
      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
      <XAxis dataKey="_x" {...EJE} interval="preserveStartEnd" minTickGap={16} />
      <YAxis {...EJE} width={60} tickCount={4} tickFormatter={(v: number) => compacto(v, tipoY)} />
    </>
  );
  const unPunto = datos.length === 1;
  const punto = { r: 4, stroke: "hsl(var(--card))", strokeWidth: 2 };

  return (
    <div>
      {leyenda}
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          {pieza.forma === "barras" ? (
            <BarChart data={datos} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={2}>
              {ejes}
              <Tooltip content={tip} cursor={{ fill: "hsl(var(--muted))" }} />
              {colsY.map((c, i) => (
                <Bar
                  key={c.clave}
                  dataKey={c.clave}
                  name={c.titulo}
                  fill={serie(i)}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                  isAnimationActive={animar}
                />
              ))}
            </BarChart>
          ) : pieza.forma === "area" ? (
            <AreaChart data={datos} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              {ejes}
              <Tooltip content={tip} cursor={{ stroke: "hsl(var(--border-strong))", strokeWidth: 1 }} />
              {colsY.map((c, i) => (
                <Area
                  key={c.clave}
                  type="linear"
                  dataKey={c.clave}
                  name={c.titulo}
                  stroke={serie(i)}
                  strokeWidth={2}
                  fill={serie(i)}
                  fillOpacity={0.1}
                  dot={unPunto ? { ...punto, fill: serie(i) } : false}
                  activeDot={{ ...punto, fill: serie(i) }}
                  isAnimationActive={animar}
                />
              ))}
            </AreaChart>
          ) : (
            <LineChart data={datos} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              {ejes}
              <Tooltip content={tip} cursor={{ stroke: "hsl(var(--border-strong))", strokeWidth: 1 }} />
              {colsY.map((c, i) => (
                <Line
                  key={c.clave}
                  type="linear"
                  dataKey={c.clave}
                  name={c.titulo}
                  stroke={serie(i)}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={unPunto ? { ...punto, fill: serie(i) } : false}
                  activeDot={{ ...punto, fill: serie(i) }}
                  isAnimationActive={animar}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Con dos o más series siempre hay leyenda: el color solo no alcanza para saber cuál es cuál. */
function Leyenda({ series, linea }: { series: ColumnaVista[]; linea: boolean }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {series.map((c, i) => (
        <li key={c.clave} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn("shrink-0", linea ? "h-0.5 w-3 rounded-full" : "size-2.5 rounded-sm")}
            style={{ background: serie(i) }}
          />
          {c.titulo}
        </li>
      ))}
    </ul>
  );
}

/** El tooltip: el valor manda (fuerte), el nombre de la serie acompaña. */
function Tip({
  active,
  payload,
  tipoY,
  colX,
  agrupar,
  varias,
}: {
  active?: boolean;
  payload?: { value: unknown; name: string; color?: string; stroke?: string; fill?: string; payload: Record<string, unknown> }[];
  tipoY: TipoColumna;
  colX: ColumnaVista;
  agrupar: unknown;
  varias: boolean;
}) {
  if (!active || !payload?.length) return null;
  const crudo = payload[0].payload[colX.clave];
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-float">
      <p className="mb-1 text-muted-foreground">{valorConFormato(crudo, colX.tipo, agrupar)}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: p.color ?? p.stroke ?? p.fill }} />
          <span className="cifra font-semibold text-foreground">{valorConFormato(p.value, tipoY)}</span>
          {varias ? <span className="text-muted-foreground">{p.name}</span> : null}
        </p>
      ))}
    </div>
  );
}

/**
 * Partes de un todo: dona con seis porciones como mucho (el resto en
 * "Otros", en gris) y al lado la leyenda con el valor y la parte de cada una.
 */
function Torta({ filas, x, y }: { filas: Record<string, unknown>[]; x: string; y: ColumnaVista }) {
  const partes = porciones(filas, x, y.clave);
  const color = (i: number) => (partes[i].otros ? "var(--viz-otros)" : serie(i));
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="size-[168px] shrink-0">
        {/* Tamaño fijo y no ResponsiveContainer: medido en 0×0 al montar, la dona quedaba sin porciones. */}
        <PieChart width={168} height={168}>
            <Pie
              data={partes}
              dataKey="valor"
              nameKey="nombre"
              innerRadius="58%"
              outerRadius="100%"
              stroke="hsl(var(--card))"
              strokeWidth={2}
              isAnimationActive={!reducido()}
            >
              {partes.map((p, i) => (
                <Cell key={p.nombre} fill={color(i)} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }: any) =>
                active && payload?.length ? (
                  <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-float">
                    <p className="mb-1 text-muted-foreground">{payload[0].name}</p>
                    <p className="cifra font-semibold text-foreground">
                      {valorConFormato(payload[0].value, y.tipo)} · {payload[0].payload.parte.toLocaleString("es-BO")} %
                    </p>
                  </div>
                ) : null
              }
            />
        </PieChart>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1.5 text-[13px]" data-testid="vista-torta">
        {partes.map((p, i) => (
          <li key={p.nombre} className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: color(i) }} />
            <span className="min-w-0 flex-1 truncate text-foreground">{p.nombre}</span>
            <span className="cifra shrink-0 font-semibold text-foreground">{valorConFormato(p.valor, y.tipo)}</span>
            <span className="cifra w-12 shrink-0 text-right text-muted-foreground">
              {p.parte.toLocaleString("es-BO", { maximumFractionDigits: 1 })} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------ ranking

/** Los primeros, con su barra contra el primero. Con productos, la foto: se reconocen por la foto. */
function Ranking({ pieza, tabla }: { pieza: Extract<PiezaDatos, { tipo: "ranking" }>; tabla: TablaVista }) {
  const tipoEtiqueta = tabla.columnas.find((c) => c.clave === pieza.etiqueta)?.tipo;
  const tipoValor = tabla.columnas.find((c) => c.clave === pieza.valor)?.tipo ?? "numero";
  const lista = puestos(tabla.filas, pieza.etiqueta, pieza.valor);
  // El producto de cada puesto, para abrir su ficha (mismo orden que `puestos`).
  const producto = (etiqueta: string) => {
    const fila = tabla.filas.find((f) => String(f[pieza.etiqueta]) === etiqueta);
    return fila ? productoDeFila(fila, pieza.etiqueta) : null;
  };
  return (
    <ol className="space-y-2.5" data-testid="vista-ranking">
      {lista.map((p, i) => (
        <li key={`${p.etiqueta}-${i}`} data-testid="vista-puesto" className="flex items-center gap-3">
          <span className="cifra w-4 shrink-0 text-right text-xs text-muted-foreground">{i + 1}</span>
          {tipoEtiqueta === "producto" ? <FotoProducto src={p.imagen} className="size-9" /> : null}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <NombreProducto nombre={p.etiqueta} producto={tipoEtiqueta === "producto" ? producto(p.etiqueta) : null} />
              <span className="cifra shrink-0 text-[13px] font-semibold text-foreground">
                {valorConFormato(p.valor, tipoValor)}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-primary-soft">
              <div className="h-full rounded-full" style={{ width: `${p.proporcion * 100}%`, background: serie(0) }} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ------------------------------------------------------------ tabla

const NUMERICAS: TipoColumna[] = ["dinero", "numero", "porcentaje"];

/** La tabla: el detalle de una pieza, o la forma de leer un gráfico sin el gráfico. */
export function TablaDatos({
  tabla,
  columnas,
  agrupar,
  max = 8,
}: {
  tabla: TablaVista;
  columnas?: string[];
  agrupar?: unknown;
  max?: number;
}) {
  const [todas, setTodas] = useState(false);
  const cols = columnas?.length
    ? (columnas.map((c) => tabla.columnas.find((x) => x.clave === c)).filter(Boolean) as ColumnaVista[])
    : tabla.columnas;
  const filas = todas ? tabla.filas : tabla.filas.slice(0, max);
  return (
    <div data-testid="vista-tabla">
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              {cols.map((c) => (
                <th
                  key={c.clave}
                  scope="col"
                  className={cn("whitespace-nowrap py-1.5 pr-3 font-medium last:pr-0", NUMERICAS.includes(c.tipo) ? "text-right" : "text-left")}
                >
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i} className="border-b border-border/60 last:border-0">
                {cols.map((c) => (
                  <td
                    key={c.clave}
                    className={cn(
                      "py-2 pr-3 align-middle last:pr-0",
                      NUMERICAS.includes(c.tipo) ? "cifra whitespace-nowrap text-right" : "text-foreground",
                    )}
                  >
                    {c.tipo === "producto" ? (
                      <span className="flex min-w-0 items-center gap-2">
                        <FotoProducto src={f._imagen as string | null} className="size-7" />
                        <NombreProducto nombre={String(f[c.clave] ?? "—")} producto={productoDeFila(f, c.clave)} />
                      </span>
                    ) : (
                      valorConFormato(f[c.clave], c.tipo, agrupar)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tabla.filas.length > max ? (
        <button
          type="button"
          onClick={() => setTodas((v) => !v)}
          data-no-imprimir
          className="mt-2 text-xs font-medium text-primary hover:underline"
        >
          {todas ? "Ver menos" : `Ver las ${tabla.filas.length} filas`}
        </button>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------ productos tocables (G4)

/**
 * El nombre de un producto en una vista: tocarlo abre su ficha en el panel,
 * igual que en el chat. Sin acciones (fuera del asistente) es solo texto.
 */
function NombreProducto({ nombre, producto }: { nombre: string; producto: ProductoOpcion | null }) {
  const acciones = useAccionesVista();
  if (!producto || !acciones) {
    return <span className="truncate text-[13px] font-medium text-foreground">{nombre}</span>;
  }
  return (
    <button
      type="button"
      data-testid="vista-producto"
      onClick={() => acciones.verProducto(producto)}
      title={`Ver ${nombre}`}
      className="truncate text-left text-[13px] font-medium text-foreground underline-offset-2 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {nombre}
    </button>
  );
}

// ------------------------------------------------------------ reponer (G4, el puente a N1)

/**
 * "Reponer estos 3": carga los productos a la compra con la cantidad sugerida
 * y el último costo, y la abre para revisarla. NO registra: la compra sigue
 * siendo un toque de la persona, como cuando la arma hablando.
 */
function Reponer({ tabla }: { tabla: TablaVista }) {
  const acciones = useAccionesVista();
  const items = paraReponer(tabla.filas);
  if (items.length === 0) return <Vacio>No hay nada para reponer.</Vacio>;
  const yaEsta = acciones?.enCompra(items.map((i) => i.producto.productId)) ?? false;
  return (
    <div data-testid="vista-reponer">
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.producto.productId} className="flex items-center gap-3" data-testid="vista-reponer-item">
            <FotoProducto src={it.producto.imagen} className="size-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-foreground">{it.producto.nombre}</p>
              <p className="text-xs text-muted-foreground">
                Stock {it.producto.stock.toLocaleString("es-BO")} ·{" "}
                {it.costo != null ? `último costo Bs ${dinero(it.costo)}` : "sin costo cargado"}
              </p>
            </div>
            <span className="cifra shrink-0 text-[13px] font-semibold text-foreground">+{it.cantidad}</span>
          </li>
        ))}
      </ul>
      {acciones ? (
        <div className="mt-3 flex flex-wrap items-center gap-3" data-no-imprimir>
          {yaEsta ? (
            <>
              <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-success-soft-foreground" data-testid="vista-reponer-hecho">
                <Check className="size-4" />
                Ya está en la compra
              </p>
              <BotonSecundario onClick={acciones.verCompra}>Ver la compra</BotonSecundario>
            </>
          ) : (
            <>
              <BotonCta data-testid="vista-reponer-boton" onClick={() => acciones.reponer(items)}>
                <Truck />
                {items.length === 1 ? "Reponer este" : `Reponer estos ${items.length}`}
              </BotonCta>
              <p className="text-xs text-muted-foreground">Se carga a la compra para que la revises: todavía no se registra nada.</p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------ alerta (G4)

/**
 * Un hallazgo destacado. La regla es fija (`alertaDe`) y los números salen de
 * los datos: la IA decidió mostrarla, no qué dice. Color de estado siempre con
 * su ícono, nunca solo.
 */
export function PiezaAlerta({ pieza, storeId }: { pieza: Extract<PiezaVista, { tipo: "alerta" }>; storeId: string }) {
  const consulta = useFuenteVista(storeId, pieza.fuente, pieza.params);
  if (consulta.isLoading) return <Skeleton className="h-16 rounded-xl" data-testid="vista-cargando" />;
  const alerta = consulta.data ? alertaDe(pieza.fuente, consulta.data) : null;
  if (!alerta) return null;
  const advierte = alerta.nivel === "advertencia";
  return (
    <section
      data-testid="vista-pieza"
      data-tipo="alerta"
      data-fuente={pieza.fuente}
      data-nivel={alerta.nivel}
      role={advierte ? "alert" : undefined}
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3",
        advierte ? "border-warning/30 bg-warning-soft" : "border-success/25 bg-success-soft",
      )}
    >
      {advierte ? (
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-soft-foreground" aria-hidden />
      ) : (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-soft-foreground" aria-hidden />
      )}
      <div className="min-w-0">
        <p className={cn("text-sm font-semibold", advierte ? "text-warning-soft-foreground" : "text-success-soft-foreground")}>
          {alerta.texto}
        </p>
        {alerta.detalle ? <p className="mt-0.5 text-[13px] text-foreground/80">{alerta.detalle}</p> : null}
      </div>
    </section>
  );
}

// ------------------------------------------------------------ comparativa (G4)

/**
 * Un período contra otro, fila por fila: lee la misma fuente dos veces. La
 * diferencia va con flecha y signo (no solo color), y en porcentaje cuando
 * el segundo período tiene con qué comparar.
 */
export function PiezaComparativa({
  pieza,
  storeId,
}: {
  pieza: Extract<PiezaVista, { tipo: "comparativa" }>;
  storeId: string;
}) {
  const [pa, pb] = pieza.periodos;
  const a = useFuenteVista(storeId, pieza.fuente, { ...pieza.params, periodo: pa });
  const b = useFuenteVista(storeId, pieza.fuente, { ...pieza.params, periodo: pb });
  const [todas, setTodas] = useState(false);
  const subtitulo = `${etiquetaPeriodo(pa)} vs. ${etiquetaPeriodo(pb)}`;

  if (a.isLoading || b.isLoading) {
    return (
      <Marco pieza={pieza} titulo={pieza.titulo} periodo={subtitulo}>
        <Skeleton className="h-[160px] rounded-lg" data-testid="vista-cargando" />
      </Marco>
    );
  }
  if (!a.data || !b.data) {
    return (
      <Marco pieza={pieza} titulo={pieza.titulo} periodo={subtitulo}>
        <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
          <AlertCircle className="size-4 shrink-0 text-destructive" />
          <span className="flex-1">No pude leer estos datos.</span>
          <button
            type="button"
            onClick={() => {
              a.refetch();
              b.refetch();
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
          >
            <RotateCcw className="size-3.5" />
            Reintentar
          </button>
        </div>
      </Marco>
    );
  }

  const tipoValor = a.data.columnas.find((c) => c.clave === pieza.valor)?.tipo ?? "numero";
  const tituloEtiqueta = a.data.columnas.find((c) => c.clave === pieza.etiqueta)?.titulo ?? "";
  const filas = comparar(a.data.filas, b.data.filas, pieza.etiqueta, pieza.valor);
  const visibles = todas ? filas : filas.slice(0, 8);

  return (
    <Marco pieza={pieza} titulo={pieza.titulo} periodo={subtitulo} refrescando={a.isFetching || b.isFetching}>
      {filas.length === 0 ? (
        <Vacio>No hubo ventas en ninguno de los dos períodos.</Vacio>
      ) : (
        <div data-testid="vista-comparativa">
          {/* Teléfono: una fila por renglón, con la diferencia arriba (en tabla quedaba cortada). */}
          <ul className="divide-y divide-border/60 sm:hidden">
            {visibles.map((f) => (
              <li key={f.etiqueta} className="py-2" data-testid="vista-comparada-movil">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13px] font-medium text-foreground">{f.etiqueta}</span>
                  <Diferencia fila={f} tipo={tipoValor} />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span className="cifra font-semibold text-foreground">{valorConFormato(f.a, tipoValor)}</span> {etiquetaPeriodo(pa).toLowerCase()} ·{" "}
                  <span className="cifra">{valorConFormato(f.b, tipoValor)}</span> {etiquetaPeriodo(pb).toLowerCase()}
                </p>
              </li>
            ))}
          </ul>
          <div className="-mx-1 hidden overflow-x-auto px-1 sm:block">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="py-1.5 pr-3 text-left font-medium">{tituloEtiqueta}</th>
                  <th scope="col" className="whitespace-nowrap py-1.5 pr-3 text-right font-medium">{etiquetaPeriodo(pa)}</th>
                  <th scope="col" className="whitespace-nowrap py-1.5 pr-3 text-right font-medium">{etiquetaPeriodo(pb)}</th>
                  <th scope="col" className="whitespace-nowrap py-1.5 text-right font-medium">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => (
                  <tr key={f.etiqueta} className="border-b border-border/60 last:border-0" data-testid="vista-comparada">
                    <td className="max-w-[12rem] truncate py-2 pr-3 text-foreground">{f.etiqueta}</td>
                    <td className="cifra whitespace-nowrap py-2 pr-3 text-right font-semibold text-foreground">{valorConFormato(f.a, tipoValor)}</td>
                    <td className="cifra whitespace-nowrap py-2 pr-3 text-right text-muted-foreground">{valorConFormato(f.b, tipoValor)}</td>
                    <td className="whitespace-nowrap py-2 text-right">
                      <Diferencia fila={f} tipo={tipoValor} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filas.length > 8 ? (
            <button type="button" onClick={() => setTodas((v) => !v)} data-no-imprimir className="mt-2 text-xs font-medium text-primary hover:underline">
              {todas ? "Ver menos" : `Ver las ${filas.length} filas`}
            </button>
          ) : null}
        </div>
      )}
    </Marco>
  );
}

function Diferencia({ fila, tipo }: { fila: ReturnType<typeof comparar>[number]; tipo: TipoColumna }) {
  const d = fila.diferencia;
  const tono = d > 0 ? "text-success-soft-foreground" : d < 0 ? "text-destructive-soft-foreground" : "text-muted-foreground";
  const Icono = d > 0 ? ArrowUpRight : d < 0 ? ArrowDownRight : Minus;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[12px] font-semibold", tono)} data-testid="vista-diferencia">
      <Icono className="size-3.5" aria-label={d > 0 ? "subió" : d < 0 ? "bajó" : "igual"} />
      <span className="cifra">
        {d > 0 ? "+" : d < 0 ? "−" : ""}
        {valorConFormato(Math.abs(d), tipo)}
      </span>
      {fila.pct != null ? (
        <span className="cifra font-normal text-muted-foreground">
          ({fila.pct > 0 ? "+" : ""}
          {fila.pct.toLocaleString("es-BO", { maximumFractionDigits: 1 })} %)
        </span>
      ) : null}
    </span>
  );
}

// ------------------------------------------------------------ conclusión

/**
 * La conclusión la escribe la IA con los números de esta vista. El servidor
 * descarta toda frase con una cifra que no está en los datos; si no queda
 * ninguna, se dice eso en vez de inventar.
 */
export function PiezaConclusion({ storeId, pregunta, vista }: { storeId: string; pregunta: string; vista: VistaSpec }) {
  const { data, isLoading, isError } = useConclusionVista(storeId, pregunta, vista);
  return (
    <section
      data-testid="vista-conclusion"
      data-estado={isLoading ? "cargando" : data ? "lista" : "vacia"}
      aria-busy={isLoading}
      className="min-w-0 rounded-xl border border-primary/20 bg-primary-soft/60 p-4"
    >
      <header className="mb-2 flex items-center gap-2">
        <Sparkles className="size-4 shrink-0 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Conclusión</h3>
      </header>
      {isLoading ? (
        <div className="space-y-2">
          <span className="sr-only">Leyendo los números…</span>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      ) : data ? (
        <p className="text-sm leading-relaxed text-foreground">{data}</p>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          {isError
            ? "No pude escribir la conclusión ahora. Los números de arriba son exactos."
            : "No encontré nada que se pueda afirmar solo con estos números. Los datos de arriba son exactos."}
        </p>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">Escrita por la IA solo con los números de esta vista.</p>
    </section>
  );
}
