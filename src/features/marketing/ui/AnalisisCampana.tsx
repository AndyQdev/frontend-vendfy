import {
  ArrowRight,
  CircleDashed,
  Hourglass,
  Lightbulb,
  Pause,
  Play,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/cn";
import { useAnalisisCampana } from "@/entities/marketing/api";
import { bs, type AccionSugerida, type CampanaDetalle, type Comparacion, type Veredicto } from "@/entities/marketing/model/types";
import { EmbudoBarras } from "./Estimacion";

export const VEREDICTO: Record<Veredicto, { icono: LucideIcon; caja: string; icono_c: string; chip: string }> = {
  valio: {
    icono: Trophy,
    caja: "border-success/30 bg-success-soft/60",
    icono_c: "bg-success text-success-foreground",
    chip: "bg-success-soft text-success-soft-foreground",
  },
  va_bien: {
    icono: TrendingUp,
    caja: "border-info/30 bg-info-soft/60",
    icono_c: "bg-info text-info-foreground",
    chip: "bg-info-soft text-info-soft-foreground",
  },
  temprano: {
    icono: Hourglass,
    caja: "border-warning/30 bg-warning-soft/50",
    icono_c: "bg-warning text-warning-foreground",
    chip: "bg-warning-soft text-warning-soft-foreground",
  },
  no_rinde: {
    icono: TrendingDown,
    caja: "border-destructive/30 bg-destructive-soft/50",
    icono_c: "bg-destructive text-destructive-foreground",
    chip: "bg-destructive-soft text-destructive-soft-foreground",
  },
  sin_datos: {
    icono: CircleDashed,
    caja: "border-border bg-muted/40",
    icono_c: "bg-muted-foreground/70 text-background",
    chip: "bg-muted text-muted-foreground",
  },
};

const COMPARACION: Record<Exclude<Comparacion, null>, string> = {
  arriba: "por encima de lo estimado",
  dentro: "dentro de lo estimado",
  abajo: "por debajo de lo estimado",
};

const CUELLO: Record<string, string> = {
  chats: "Se traba en el anuncio: escribe poca gente para lo que se gasta.",
  respuesta: "Se traba en la respuesta: escriben, pero casi nadie avanza a pedir precio o armar carrito.",
  cierre: "Se traba en el cierre: cotizan, pero no terminan de comprar.",
};

/**
 * ¿Valió la pena? La lectura de una campaña para alguien que no es
 * publicista: un veredicto con su porqué, los números que importan, el
 * retorno contra el punto de equilibrio, dónde se traba y qué hacer.
 */
export function AnalisisCampana({
  storeId,
  campana,
  onAccion,
}: {
  storeId: string;
  campana: CampanaDetalle;
  onAccion: (a: AccionSugerida) => void;
}) {
  const { data: a, isLoading, isError, refetch } = useAnalisisCampana(storeId, campana.id);
  if (isError) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
        <span className="text-muted-foreground">No se pudo leer el análisis de la campaña.</span>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Reintentar
        </Button>
      </Card>
    );
  }
  if (isLoading || !a) return <Skeleton className="h-72 rounded-2xl" />;

  const v = VEREDICTO[a.veredicto];
  const m = campana.metricas;
  const escribieron = Math.max(m.conversaciones, m.personas);
  const ind = a.indicadores;

  return (
    <div className="space-y-4">
      {/* El veredicto */}
      <Card className={cn("flex flex-col gap-4 border p-5 sm:flex-row sm:items-start", v.caja)}>
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm", v.icono_c)}>
          <v.icono className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">¿Valió la pena?</p>
          <h2 className="font-display text-xl font-bold">{a.titulo}</h2>
          <p className="mt-1 text-sm">{a.explicacion}</p>
          {a.cuello && <p className="mt-2 text-sm text-muted-foreground">{CUELLO[a.cuello]}</p>}
        </div>
      </Card>

      {/* Los números */}
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Indicador titulo="Invertido" valor={bs(m.gasto, campana.moneda)} nota={campana.presupuestoDiario ? `${bs(campana.presupuestoDiario, campana.moneda)} por día` : undefined} />
        <Indicador
          titulo="Escribieron"
          valor={String(escribieron)}
          nota={ind.costoPorChat != null ? `${bs(ind.costoPorChat, campana.moneda)} por chat` : undefined}
          comparacion={a.frenteAEstimado.chats}
        />
        <Indicador titulo="Compraron" valor={String(m.compraron)} nota={ind.costoPorVenta != null ? `${bs(ind.costoPorVenta, campana.moneda)} por venta` : undefined} />
        <Indicador titulo="Vendido" valor={bs(m.vendido)} nota={ind.ganancia != null ? `${ind.ganancia >= 0 ? "Ganancia" : "Pérdida"} aprox. ${bs(Math.abs(ind.ganancia))}` : undefined} />
        <Indicador
          titulo="Retorno"
          valor={ind.retorno != null ? `${ind.retorno}×` : "—"}
          nota={ind.retorno != null ? `Bs ${ind.retorno} por cada Bs 1` : "Sin ventas todavía"}
          comparacion={a.frenteAEstimado.retorno}
          destacado
        />
      </dl>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Retorno contra el equilibrio */}
        <Card className="space-y-3 p-5">
          <h3 className="font-semibold">Retorno contra el punto de equilibrio</h3>
          <BarraRetorno retorno={ind.retorno} equilibrio={ind.equilibrio} estimado={campana.estimacion?.roas ?? null} />
          <p className="text-xs text-muted-foreground">
            {ind.equilibrio
              ? `Con el margen de lo que vendes, cada Bs 1 de anuncio tiene que traer Bs ${ind.equilibrio} en ventas para no perder plata.`
              : "Carga el costo de tus productos para saber desde cuánto retorno ganas plata."}
          </p>
        </Card>

        {/* El camino a la venta */}
        <Card className="p-5">
          <h3 className="mb-3 font-semibold">Camino a la venta</h3>
          {a.embudo && a.embudo.personas > 0 ? (
            <EmbudoBarras embudo={a.embudo} />
          ) : (
            <p className="text-sm text-muted-foreground">Todavía nadie escribió por sus anuncios.</p>
          )}
        </Card>
      </div>

      {/* Qué hacer */}
      {a.recomendaciones.length > 0 && (
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-1.5 font-semibold">
            <Lightbulb className="h-4 w-4 text-primary" /> Qué hacer
          </h3>
          <ul className="space-y-2">
            {a.recomendaciones.map((r, i) => (
              <li key={i} className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3 sm:flex-row sm:items-center">
                <p className="flex-1 text-sm">{r.texto}</p>
                <BotonAccion accion={r.accion} campana={campana} onAccion={onAccion} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Indicador({
  titulo,
  valor,
  nota,
  comparacion,
  destacado,
}: {
  titulo: string;
  valor: string;
  nota?: string;
  comparacion?: Comparacion;
  destacado?: boolean;
}) {
  return (
    <Card className={cn("p-4", destacado && "border-primary/30 bg-primary-soft/30")}>
      <dt className="etiqueta text-muted-foreground">{titulo}</dt>
      <dd className="cifra mt-1 text-xl font-bold">{valor}</dd>
      {nota && <p className="mt-0.5 text-[11px] text-muted-foreground">{nota}</p>}
      {comparacion && (
        <p
          className={cn(
            "mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium",
            comparacion === "arriba" ? "bg-success-soft text-success-soft-foreground" : comparacion === "abajo" ? "bg-warning-soft text-warning-soft-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {COMPARACION[comparacion]}
        </p>
      )}
    </Card>
  );
}

/** Una regla de 0 al máximo: el retorno real, la marca del equilibrio y la franja de lo estimado. */
function BarraRetorno({
  retorno,
  equilibrio,
  estimado,
}: {
  retorno: number | null;
  equilibrio: number | null;
  estimado: { min: number; max: number } | null;
}) {
  const tope = Math.max(retorno ?? 0, equilibrio ?? 1, estimado?.max ?? 0, 1) * 1.25;
  const x = (n: number) => `${Math.min((n / tope) * 100, 100)}%`;
  const gana = retorno != null && retorno >= (equilibrio ?? 1);
  return (
    <div className="pt-6">
      <div className="relative h-4 rounded-full bg-muted">
        {estimado && (
          <div
            className="absolute inset-y-0 rounded-full bg-primary/15"
            style={{ left: x(estimado.min), width: `calc(${x(estimado.max)} - ${x(estimado.min)})` }}
            title={`Estimado: ${estimado.min}× a ${estimado.max}×`}
          />
        )}
        {retorno != null && (
          <div className={cn("absolute inset-y-0 left-0 rounded-full", gana ? "bg-emerald-500" : "bg-amber-500")} style={{ width: x(retorno) }} />
        )}
        {equilibrio != null && (
          <div className="absolute -top-6 flex -translate-x-1/2 flex-col items-center" style={{ left: x(equilibrio) }}>
            <span className="whitespace-nowrap text-[10px] font-semibold text-muted-foreground">Equilibrio {equilibrio}×</span>
            <span className="mt-0.5 h-8 w-0.5 rounded bg-foreground/60" />
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>0×</span>
        <span className="flex items-center gap-3">
          {estimado && (
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-3 rounded-sm bg-primary/20" /> Estimado
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <span className={cn("h-2 w-3 rounded-sm", gana ? "bg-emerald-500" : "bg-amber-500")} /> Real {retorno != null ? `${retorno}×` : "—"}
          </span>
        </span>
      </div>
    </div>
  );
}

function BotonAccion({ accion, campana, onAccion }: { accion: AccionSugerida; campana: CampanaDetalle; onAccion: (a: AccionSugerida) => void }) {
  const op: Partial<Record<AccionSugerida, { texto: string; icono: LucideIcon; visible: boolean }>> = {
    seguir_chats: { texto: "Ver los chats", icono: ArrowRight, visible: true },
    pausar: { texto: "Pausar", icono: Pause, visible: campana.estado === "activa" },
    activar: { texto: "Activar", icono: Play, visible: campana.estado === "pausada" },
    subir_presupuesto: { texto: "Cambiar presupuesto", icono: Wallet, visible: campana.origen === "vendfy" && (campana.estado === "activa" || campana.estado === "pausada") },
  };
  const o = op[accion];
  if (!o?.visible) return null;
  return (
    <Button size="sm" variant="outline" className="shrink-0" onClick={() => onAccion(accion)}>
      <o.icono className="mr-1.5 h-3.5 w-3.5" /> {o.texto}
    </Button>
  );
}
