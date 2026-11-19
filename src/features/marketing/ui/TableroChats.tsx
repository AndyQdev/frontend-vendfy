import { useMemo, useState } from "react";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { Bot, Hand, Inbox, Megaphone, Search, ShoppingCart } from "lucide-react";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/shared/ui/responsive-dialog";
import { cn } from "@/shared/lib/cn";
import { useEditarLead, useLeads, useLeadsEnVivo } from "@/entities/marketing/api";
import { ETAPAS, ETAPA_INFO, MOTIVOS_A_MANO, MOTIVO_PERDIDO, bs, type Etapa, type Lead, type MotivoPerdido } from "@/entities/marketing/model/types";
import { nombreDelAnuncio, haceCuanto } from "@/features/whatsapp/chat/ui/AnuncioDeOrigen";
import { ETAPA_ESTILO, avatarDe } from "../model/etapas-ui";
import { PildoraProbabilidad } from "./Probabilidad";
import { EspacioCliente } from "./EspacioCliente";

/**
 * El tablero de una campaña (o de «WhatsApp directo»): cada persona que
 * escribió, en la etapa en que está. Las etapas se mueven solas con los
 * mensajes, el carrito y los pedidos; también se arrastra a mano (y lo movido
 * a mano no retrocede solo). Al tocar una tarjeta se abre su chat con la ficha.
 */
export function TableroChats({
  storeId,
  puedeGestionar,
  filtro,
}: {
  storeId: string;
  puedeGestionar: boolean;
  /** De qué campaña (sus anuncios) o «directo» (lo que no vino por anuncios). */
  filtro: { anuncios?: string[]; origen?: "directo" };
}) {
  const [q, setQ] = useState("");
  const [dias, setDias] = useState(90);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<Lead | null>(null);
  const [aPerdido, setAPerdido] = useState<Lead | null>(null);

  useLeadsEnVivo(storeId);
  const sinAnuncios = filtro.anuncios !== undefined && filtro.anuncios.length === 0;
  const { data, isLoading } = useLeads(storeId, {
    q: q.trim() || undefined,
    origen: filtro.origen,
    // Una campaña sin anuncios todavía no tiene chats: se pide algo que no existe.
    anuncios: sinAnuncios ? ["-"] : filtro.anuncios,
    dias,
  });
  const editar = useEditarLead(storeId);

  const porEtapa = useMemo(() => {
    const m = Object.fromEntries(ETAPAS.map((e) => [e, [] as Lead[]])) as Record<Etapa, Lead[]>;
    for (const l of data?.leads ?? []) m[l.etapa]?.push(l);
    // Dentro de cada columna, primero los que más chances tienen de comprar.
    for (const e of ETAPAS) m[e].sort((a, b) => (b.probabilidad ?? 0) - (a.probabilidad ?? 0));
    return m;
  }, [data]);
  const total = data?.leads.length ?? 0;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const mover = async (lead: Lead, etapa: Etapa, motivo?: MotivoPerdido) => {
    if (lead.etapa === etapa) return;
    try {
      await editar.mutateAsync({ id: lead.id, etapa, motivo });
      toast.success(`${lead.conversacion.contactName || lead.conversacion.contactPhone}: ${ETAPA_INFO[etapa].titulo}`);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo mover");
    }
  };

  const alSoltar = (ev: DragEndEvent) => {
    setArrastrando(null);
    const lead = (data?.leads ?? []).find((l) => l.id === ev.active.id);
    const etapa = ev.over?.id as Etapa | undefined;
    if (!lead || !etapa || lead.etapa === etapa) return;
    if (etapa === "perdido") setAPerdido(lead);
    else void mover(lead, etapa);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o teléfono…" className="pl-9" aria-label="Buscar en el tablero" />
        </div>
        <Select value={String(dias)} onValueChange={(v) => setDias(Number(v))}>
          <SelectTrigger className="w-[11rem]" aria-label="Período">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 días</SelectItem>
            <SelectItem value="30">Últimos 30 días</SelectItem>
            <SelectItem value="90">Últimos 90 días</SelectItem>
            <SelectItem value="365">Último año</SelectItem>
          </SelectContent>
        </Select>
        {!isLoading && (
          <span className="text-xs text-muted-foreground">
            {total === 1 ? "1 persona" : `${total} personas`} · los abiertos siempre se ven
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {ETAPAS.map((e) => (
            <Skeleton key={e} className="h-80 w-72 shrink-0 rounded-2xl" />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={(ev) => setArrastrando((data?.leads ?? []).find((l) => l.id === ev.active.id) ?? null)}
          onDragEnd={alSoltar}
          onDragCancel={() => setArrastrando(null)}
        >
          <div className="carril -mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-3">
            {ETAPAS.map((etapa) => (
              <Columna
                key={etapa}
                etapa={etapa}
                total={data?.conteo?.[etapa] ?? porEtapa[etapa].length}
                leads={porEtapa[etapa]}
                habilitada={puedeGestionar}
                onAbrir={setAbierto}
              />
            ))}
          </div>
          <DragOverlay>{arrastrando ? <TarjetaLead lead={arrastrando} flotando /> : null}</DragOverlay>
        </DndContext>
      )}

      <EspacioCliente storeId={storeId} leadId={abierto} onClose={() => setAbierto(null)} puedeGestionar={puedeGestionar} />

      <ResponsiveDialog open={!!aPerdido} onOpenChange={(o) => !o && setAPerdido(null)}>
        <ResponsiveDialogContent className="sm:max-w-[440px]">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>¿Por qué se perdió?</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Así sabes qué falla en el camino a la venta.</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogBody>
            <div className="grid gap-2 sm:grid-cols-2">
              {MOTIVOS_A_MANO.map((m) => (
                <Button
                  key={m}
                  variant="outline"
                  onClick={() => {
                    if (aPerdido) void mover(aPerdido, "perdido", m);
                    setAPerdido(null);
                  }}
                >
                  {MOTIVO_PERDIDO[m]}
                </Button>
              ))}
            </div>
          </ResponsiveDialogBody>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}

function Columna({
  etapa,
  total,
  leads,
  habilitada,
  onAbrir,
}: {
  etapa: Etapa;
  total: number;
  leads: Lead[];
  habilitada: boolean;
  onAbrir: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa, disabled: !habilitada });
  const info = ETAPA_INFO[etapa];
  const estilo = ETAPA_ESTILO[etapa];
  const Icono = estilo.icono;
  const valor = etapa === "compro" ? leads.reduce((t, l) => t + (l.valor ?? l.pedido?.total ?? 0), 0) : 0;
  return (
    <section
      ref={setNodeRef}
      aria-label={`${info.titulo}: ${total}`}
      className={cn(
        "relative flex w-[17.5rem] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border transition-all",
        estilo.columna,
        estilo.borde,
        isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <div className={cn("h-1 w-full", estilo.acento)} aria-hidden />
      <header className="flex items-center gap-2.5 px-3 pb-2 pt-3">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", estilo.chip)}>
          <Icono className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            {info.titulo}
            <span className="cifra rounded-full bg-background/80 px-1.5 text-[11px] font-semibold text-muted-foreground shadow-sm">{total}</span>
          </h3>
          <p className="truncate text-[11px] text-muted-foreground">{etapa === "compro" && valor ? `${bs(valor)} vendidos` : info.ayuda}</p>
        </div>
      </header>
      <div className="flex min-h-[10rem] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2" style={{ maxHeight: "calc(100dvh - 22rem)" }}>
        {leads.map((l) => (
          <Arrastrable key={l.id} lead={l} habilitado={habilitada} onAbrir={() => onAbrir(l.id)} />
        ))}
        {!leads.length && (
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/80 px-3 py-8 text-center text-xs text-muted-foreground">
            <Inbox className="h-5 w-5 opacity-60" />
            {habilitada ? "Nadie aquí. Arrastra una tarjeta para moverla." : "Nadie aquí."}
          </div>
        )}
      </div>
    </section>
  );
}

function Arrastrable({ lead, habilitado, onAbrir }: { lead: Lead; habilitado: boolean; onAbrir: () => void }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: lead.id, disabled: !habilitado });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={cn(isDragging && "opacity-40")}>
      <TarjetaLead lead={lead} onAbrir={onAbrir} />
    </div>
  );
}

function TarjetaLead({ lead, onAbrir, flotando }: { lead: Lead; onAbrir?: () => void; flotando?: boolean }) {
  const c = lead.conversacion;
  const nombre = c.contactName || c.contactPhone;
  const avatar = avatarDe(c.contactName, c.contactPhone);
  const abierta = !["compro", "perdido"].includes(lead.etapa);
  return (
    <button
      type="button"
      onClick={onAbrir}
      className={cn(
        "group w-full rounded-xl border border-border/70 bg-card p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        flotando && "rotate-2 shadow-xl",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className={cn("relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", avatar.color)}>
          {avatar.iniciales}
          {c.unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground ring-2 ring-card">
              {c.unreadCount}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="truncate text-sm font-semibold leading-tight">{nombre}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground">{haceCuanto(c.lastMessageAt ?? lead.etapaAt)}</span>
          </div>
          {c.lastMessageText && <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{c.lastMessageText}</p>}
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1">
        {abierta && lead.probabilidad != null && lead.nivel && <PildoraProbabilidad p={lead.probabilidad} nivel={lead.nivel} />}
        {lead.anuncio && (
          <span className="inline-flex max-w-[9rem] items-center gap-1 rounded-full bg-info-soft px-1.5 py-0.5 text-[10px] font-semibold text-info-soft-foreground">
            <Megaphone className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{nombreDelAnuncio(lead.anuncio)}</span>
          </span>
        )}
        {lead.pedido && (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">
            <ShoppingCart className="h-2.5 w-2.5" /> #{lead.pedido.numero ?? ""} · {bs(lead.pedido.total)}
          </span>
        )}
        {lead.etapa === "compro" && lead.valor != null && !lead.pedido && (
          <span className="cifra rounded-full bg-success-soft px-1.5 py-0.5 text-[10px] font-semibold text-success-soft-foreground">{bs(lead.valor)}</span>
        )}
        {lead.etapa === "perdido" && lead.motivoPerdido && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{MOTIVO_PERDIDO[lead.motivoPerdido]}</span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground" title={c.aiPaused ? "La atiende una persona" : "La atiende la IA"}>
          {c.aiPaused ? <Hand className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
          {lead.responsable?.nombre?.split(" ")[0] ?? ""}
        </span>
      </div>
    </button>
  );
}
