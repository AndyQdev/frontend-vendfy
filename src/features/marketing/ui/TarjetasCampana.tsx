import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Megaphone, MessageCircle, Plus } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/cn";
import { useLeads } from "@/entities/marketing/api";
import { ESTADO_CAMPANA, bs, type Campana } from "@/entities/marketing/model/types";
import { VEREDICTO } from "./AnalisisCampana";

const tarjeta =
  "group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Una campaña en la vista principal: su imagen, cómo va y sus chats abiertos. */
export function TarjetaCampana({ c }: { c: Campana }) {
  const [sinFoto, setSinFoto] = useState(false);
  const imagen = c.creativo?.imagen ?? c.productos.find((p) => p.imagen)?.imagen ?? null;
  const estado = ESTADO_CAMPANA[c.estado];
  const v = VEREDICTO[c.analisis?.veredicto ?? "sin_datos"];
  const escribieron = Math.max(c.metricas.conversaciones, c.metricas.personas);
  const sub =
    c.canal === "plantilla_wa"
      ? "Mensaje de WhatsApp"
      : c.presupuestoDiario
        ? `${bs(c.presupuestoDiario, c.moneda)} por día${c.dias ? ` · ${c.dias} días` : ""}`
        : c.origen === "importada"
          ? "Traída de Meta"
          : "Sin presupuesto";

  return (
    <Link to={`/marketing/campanas/${c.id}`} className={tarjeta}>
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        {imagen && !sinFoto ? (
          <img src={imagen} alt="" onError={() => setSinFoto(true)} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <Megaphone className="h-10 w-10 text-primary/60" />
          </div>
        )}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
          <Badge variant={estado.variant} className="shadow-sm">
            {estado.texto}
          </Badge>
          {c.analisis && c.analisis.veredicto !== "sin_datos" && (
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm", v.chip)}>
              <v.icono className="h-3 w-3" /> {c.analisis.titulo}
            </span>
          )}
        </div>
        {c.chats?.sinLeer > 0 && (
          <span className="absolute bottom-2.5 right-2.5 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground shadow">
            {c.chats.sinLeer} sin leer
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="line-clamp-2 font-semibold leading-snug">{c.nombre}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
        </div>
        <dl className="grid grid-cols-4 gap-1 rounded-xl bg-muted/50 p-2 text-center">
          <Dato t="Escribieron" v={String(escribieron)} />
          <Dato t="Compraron" v={String(c.metricas.compraron)} />
          <Dato t="Gastó" v={bs(c.metricas.gasto, c.moneda)} />
          <Dato t="Retorno" v={c.metricas.roas != null ? `${c.metricas.roas}×` : "—"} />
        </dl>
        <div className="mt-auto flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">
            {c.chats?.abiertos ? `${c.chats.abiertos} chats abiertos` : c.estado === "borrador" ? "Termina el borrador" : "Sin chats abiertos"}
            {c.chats?.porCerrar ? ` · ${c.chats.porCerrar} por cerrar` : ""}
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-primary">
            Abrir <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function Dato({ t, v }: { t: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[10px] text-muted-foreground">{t}</dt>
      <dd className="cifra truncate text-sm font-bold">{v}</dd>
    </div>
  );
}

/** Los chats que no vinieron por un anuncio: el WhatsApp de siempre, con el mismo tablero. */
export function TarjetaDirecto({ storeId }: { storeId: string }) {
  const { data, isLoading } = useLeads(storeId, { origen: "directo", dias: 30 });
  const conteo = data?.conteo;
  const abiertos = conteo ? conteo.nuevo + conteo.conversando + conteo.cotizado + conteo.pidio : 0;
  const sinLeer = (data?.leads ?? []).reduce((t, l) => t + (l.conversacion.unreadCount ?? 0), 0);
  return (
    <Link to="/marketing/campanas/directo" className={tarjeta}>
      <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden bg-gradient-to-br from-[#25D366] to-[#128C7E]">
        <div className="absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-white/10" aria-hidden />
        <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-white/10" aria-hidden />
        <MessageCircle className="h-12 w-12 text-white drop-shadow" />
        {sinLeer > 0 && (
          <span className="absolute bottom-2.5 right-2.5 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#128C7E] shadow">{sinLeer} sin leer</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-semibold leading-snug">WhatsApp directo</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Los que te escribieron sin pasar por un anuncio</p>
        </div>
        {isLoading ? (
          <Skeleton className="h-12 rounded-xl" />
        ) : (
          <dl className="grid grid-cols-3 gap-1 rounded-xl bg-muted/50 p-2 text-center">
            <Dato t="Abiertos" v={String(abiertos)} />
            <Dato t="Sin responder" v={String(conteo?.nuevo ?? 0)} />
            <Dato t="Compraron" v={String(conteo?.compro ?? 0)} />
          </dl>
        )}
        <div className="mt-auto flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Últimos 30 días</span>
          <span className="inline-flex items-center gap-1 font-medium text-primary">
            Abrir <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

/** La primera tarjeta: armar una campaña nueva desde las ideas. */
export function TarjetaNueva({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[18rem] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/30 bg-primary-soft/20 p-6 text-center transition-colors hover:border-primary/60 hover:bg-primary-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-md transition-transform group-hover:scale-105" style={{ background: "var(--primary-grad)" }}>
        <Plus className="h-7 w-7" />
      </span>
      <span className="font-semibold">Nueva campaña</span>
      <span className="max-w-[15rem] text-xs text-muted-foreground">Ideas con tus datos: qué anunciar, cuánto invertir y qué esperar.</span>
    </button>
  );
}
