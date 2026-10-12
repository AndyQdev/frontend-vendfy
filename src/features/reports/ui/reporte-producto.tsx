import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { BarChart3, Minus, TrendingDown, TrendingUp, Truck, Users } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/cn";
import { formatMoney } from "@/shared/lib/money";
import { ChipProductoEscaneado, haceCuanto, type ProductoFiltrado } from "@/features/scanner";
import { useReportProduct } from "../api";
import type { ReportQueryParams, ReporteProducto as Reporte } from "../model/types";

/**
 * Estadísticas de un solo producto: lo que se ve al escanearlo en
 * Estadísticas. Mismo período y tienda que el resto de la pantalla; el chip
 * vuelve a las estadísticas de todo.
 */
export function ReporteProducto({
  producto,
  params,
  periodoTexto,
  onQuitar,
}: {
  producto: ProductoFiltrado;
  params: ReportQueryParams;
  /** "en los últimos 7 días", "hoy"… */
  periodoTexto: string;
  onQuitar: () => void;
}) {
  const { data: r, isLoading } = useReportProduct(params, producto.id);

  return (
    <div className="space-y-6" data-testid="reporte-producto">
      <ChipProductoEscaneado
        nombre={producto.nombre}
        imagen={producto.imagen}
        cargando={isLoading}
        resumen={r ? resumen(r, periodoTexto) : undefined}
        onQuitar={onQuitar}
        quitarEtiqueta="Ver las estadísticas de todo"
      />

      {isLoading || !r ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-3 h-7 w-24" />
              <Skeleton className="mt-2 h-3 w-32" />
            </Card>
          ))}
        </div>
      ) : (
        <>
          <Cifras r={r} />
          <GraficoUnidades r={r} />
          <div className="grid gap-6 md:grid-cols-2">
            <UltimaCompra r={r} />
            <QuienesLoCompran r={r} periodoTexto={periodoTexto} />
          </div>
        </>
      )}
    </div>
  );
}

function resumen(r: Reporte, periodoTexto: string): string {
  const p = r.periodo;
  if (p.unidades === 0) {
    const ultima = haceCuanto(r.ultimaVenta);
    return `No se vendió ${periodoTexto}${ultima ? ` · la última venta fue ${ultima}` : ""}.`;
  }
  return `Vendiste ${p.unidades} ${periodoTexto} en ${p.ventas} ${p.ventas === 1 ? "venta" : "ventas"} · ${formatMoney(p.ingresos)}`;
}

/** Las cuatro cifras: vendidas, ingresos, ganancia y para cuántos días alcanza. */
function Cifras({ r }: { r: Reporte }) {
  const p = r.periodo;
  const ganancia = p.costo != null ? p.ingresos - p.costo : null;
  const margen = ganancia != null && p.ingresos > 0 ? Math.round((ganancia / p.ingresos) * 100) : null;
  const libre = r.stock ? Math.max(0, r.stock.disponible - r.stock.reservado) : null;
  const porDia = p.dias && p.unidades > 0 ? p.unidades / p.dias : null;
  const alcanza = libre != null && porDia ? Math.floor(libre / porDia) : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Cifra
        etiqueta="Vendidas"
        valor={p.unidades.toLocaleString("es-BO")}
        detalle={
          <>
            <Comparacion actual={p.unidades} anterior={r.anterior?.unidades} />
            {r.ranking && (
              <span className="block">
                El {r.ranking.puesto}.º más vendido de {r.ranking.de}
              </span>
            )}
          </>
        }
      />
      <Cifra
        etiqueta="Ingresos"
        valor={formatMoney(p.ingresos)}
        detalle={<Comparacion actual={p.ingresos} anterior={r.anterior?.ingresos} />}
      />
      <Cifra
        etiqueta="Ganancia"
        valor={ganancia != null ? formatMoney(ganancia) : "—"}
        detalle={
          ganancia == null
            ? p.unidades > 0
              ? "Sin costo registrado: cargá una compra"
              : "Sin ventas en el período"
            : `Margen ${margen} %${p.costoCompleto ? "" : " · aprox."}`
        }
        tono={ganancia != null && ganancia < 0 ? "malo" : undefined}
      />
      <Cifra
        etiqueta="Stock"
        valor={libre != null ? libre.toLocaleString("es-BO") : "—"}
        detalle={
          libre == null
            ? "No lo tenés en esta tienda"
            : libre === 0
              ? "Sin stock"
              : alcanza != null
                ? alcanza === 0
                  ? "Al ritmo de venta, se acaba hoy"
                  : `Al ritmo de venta, alcanza para ~${alcanza} ${alcanza === 1 ? "día" : "días"}`
                : r.stock!.reservado > 0
                  ? `${r.stock!.reservado} más reservados`
                  : "Sin ventas para calcular cuánto dura"
        }
        tono={libre === 0 || (alcanza != null && alcanza < 7) ? "atencion" : undefined}
      />
    </div>
  );
}

function Cifra({
  etiqueta,
  valor,
  detalle,
  tono,
}: {
  etiqueta: string;
  valor: string;
  detalle: ReactNode;
  tono?: "malo" | "atencion";
}) {
  return (
    <Card className="p-4">
      <p className="etiqueta text-[11px] text-muted-foreground">{etiqueta}</p>
      <p
        className={cn(
          "cifra mt-1 text-2xl font-bold",
          tono === "malo" && "text-destructive",
          tono === "atencion" && "text-warning",
        )}
      >
        {valor}
      </p>
      <div className="mt-1 text-xs text-muted-foreground">{detalle}</div>
    </Card>
  );
}

/** "▲ 20 % que el período anterior": con flecha y palabra, no solo color. */
function Comparacion({ actual, anterior }: { actual: number; anterior: number | undefined }) {
  if (anterior == null) return null;
  if (anterior === 0) {
    return <span className="block">{actual > 0 ? "Antes no se vendía" : "Tampoco en el período anterior"}</span>;
  }
  const cambio = Math.round(((actual - anterior) / anterior) * 100);
  if (cambio === 0) {
    return (
      <span className="flex items-center gap-1">
        <Minus className="h-3 w-3" aria-hidden /> Igual que el período anterior
      </span>
    );
  }
  const sube = cambio > 0;
  const Icono = sube ? TrendingUp : TrendingDown;
  return (
    <span className={cn("flex items-center gap-1", sube ? "text-success" : "text-destructive")}>
      <Icono className="h-3 w-3" aria-hidden />
      {sube ? "+" : "−"}
      {Math.abs(cambio)} % que el período anterior
    </span>
  );
}

const TITULO: Record<Reporte["granularidad"], string> = {
  hour: "Vendidas por hora",
  day: "Vendidas por día",
  week: "Vendidas por semana",
  month: "Vendidas por mes",
};

function etiquetaFecha(fecha: string, g: Reporte["granularidad"], larga = false): string {
  if (g === "hour") return fecha;
  if (g === "month") return format(parseISO(`${fecha}-01`), larga ? "MMMM yyyy" : "MMM yy", { locale: es });
  const d = format(parseISO(fecha), larga ? "EEEE d 'de' MMMM" : "d MMM", { locale: es });
  return g === "week" ? `Semana del ${d}` : d;
}

function GraficoUnidades({ r }: { r: Reporte }) {
  const hayVentas = r.serie.some((s) => s.unidades > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{TITULO[r.granularidad]}</CardTitle>
        <CardDescription>Solo ventas completadas, como el resto de Estadísticas.</CardDescription>
      </CardHeader>
      <CardContent>
        {!hayVentas ? (
          <div className="flex h-[220px] flex-col items-center justify-center text-muted-foreground/70">
            <BarChart3 className="h-8 w-8" aria-hidden />
            <p className="mt-2 text-sm">No se vendió en este período</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={r.serie} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%">
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="fecha"
                tickFormatter={(f: string) => etiquetaFecha(f, r.granularidad)}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                minTickGap={12}
              />
              <YAxis
                allowDecimals={false}
                width={32}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.6 }}
                content={({ active, payload }) => {
                  const s = active && payload?.[0]?.payload;
                  if (!s) return null;
                  return (
                    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                      <p className="font-medium first-letter:uppercase">
                        {etiquetaFecha(s.fecha, r.granularidad, true)}
                      </p>
                      <p className="cifra mt-0.5">
                        {s.unidades} {s.unidades === 1 ? "vendida" : "vendidas"} · {formatMoney(s.ingresos)}
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="unidades" fill="hsl(var(--acento))" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function UltimaCompra({ r }: { r: Reporte }) {
  const c = r.ultimaCompra;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <Truck className="h-4 w-4 text-muted-foreground" aria-hidden />
        <CardTitle className="text-base">Última compra</CardTitle>
      </CardHeader>
      <CardContent>
        {!c ? (
          <p className="text-sm text-muted-foreground">Todavía no lo compraste.</p>
        ) : (
          <>
            <p className="cifra text-xl font-bold">
              {c.costo != null ? `${formatMoney(c.costo)} c/u` : "Sin costo"}
            </p>
            <p className="text-sm text-muted-foreground">
              {c.cantidad.toLocaleString("es-BO")} {c.cantidad === 1 ? "unidad" : "unidades"}
              {c.proveedor ? ` a ${c.proveedor}` : ""} · {haceCuanto(c.fecha)}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function QuienesLoCompran({ r, periodoTexto }: { r: Reporte; periodoTexto: string }) {
  const n = r.periodo.clientes;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
        <CardTitle className="text-base">Quiénes lo compran</CardTitle>
      </CardHeader>
      <CardContent>
        {n === 0 ? (
          <p className="text-sm text-muted-foreground">Nadie lo compró {periodoTexto}.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {n} {n === 1 ? "cliente" : "clientes"} {periodoTexto}
            </p>
            <ul className="mt-2 divide-y">
              {r.clientesTop.map((c) => (
                <li key={c.nombre} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="truncate">{c.nombre}</span>
                  <span className="cifra shrink-0 text-muted-foreground">
                    {c.unidades} {c.unidades === 1 ? "unidad" : "unidades"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
