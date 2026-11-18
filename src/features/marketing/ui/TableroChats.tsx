import { useMemo, useState } from "react";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { Bot, Hand, Megaphone, Search, ShoppingCart, UserRound } from "lucide-react";
import { Card } from "@/shared/ui/card";
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
import { FichaLead } from "./FichaLead";

/**
 * El tablero del CRM de WhatsApp: cada persona que escribió, en la etapa en
 * que está. Cinco etapas se mueven solas con los mensajes, el carrito y los
 * pedidos; también se arrastra a mano (y lo movido a mano no retrocede solo).
 */
export function TableroChats({
  storeId,
  puedeGestionar,
  anunciosDeCampana,
  tituloCampana,
}: {
  storeId: string;
  puedeGestionar: boolean;
  /** Si viene de una campaña: solo los que llegaron por sus anuncios. */
  anunciosDeCampana?: string[];
  tituloCampana?: string;
}) {
  const [q, setQ] = useState("");
  const [origen, setOrigen] = useState<string>("todos");
  const [dias, setDias] = useState(30);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<Lead | null>(null);
  const [aPerdido, setAPerdido] = useState<Lead | null>(null);

  useLeadsEnVivo(storeId);
  const { data, isLoading } = useLeads(storeId, {
    q: q.trim() || undefined,
    origen: origen === "todos" ? undefined : origen,
    anuncios: anunciosDeCampana,
    dias,
  });
  const editar = useEditarLead(storeId);

  const porEtapa = useMemo(() => {
    const m = Object.fromEntries(ETAPAS.map((e) => [e, [] as Lead[]])) as Record<Etapa, Lead[]>;
    for (const l of data?.leads ?? []) m[l.etapa]?.push(l);
    return m;
  }, [data]);

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
      <Card className="flex flex-wrap items-center gap-3 p-3">
        {tituloCampana && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800 dark:bg-sky-900/30 dark:text-sky-300">
            <Megaphone className="h-3.5 w-3.5" /> {tituloCampana}
          </span>
        )}
        <div className="relative min-w-[12rem] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o teléfono…" className="pl-9" aria-label="Buscar" />
        </div>
        {!anunciosDeCampana && (
          <Select value={origen} onValueChange={setOrigen}>
            <SelectTrigger className="w-[12rem]" aria-label="Origen">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los chats</SelectItem>
              <SelectItem value="anuncio">Vinieron de anuncios</SelectItem>
              <SelectItem value="organico">Escribieron solos</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={String(dias)} onValueChange={(v) => setDias(Number(v))}>
          <SelectTrigger className="w-[10rem]" aria-label="Período">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 días</SelectItem>
            <SelectItem value="30">Últimos 30 días</SelectItem>
            <SelectItem value="90">Últimos 90 días</SelectItem>
            <SelectItem value="365">Último año</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      {isLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {ETAPAS.map((e) => (
            <Skeleton key={e} className="h-72 w-72 shrink-0 rounded-xl" />
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

      <FichaLead storeId={storeId} leadId={abierto} onClose={() => setAbierto(null)} puedeGestionar={puedeGestionar} />

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
  const valor = etapa === "compro" ? leads.reduce((t, l) => t + (l.valor ?? 0), 0) : 0;
  return (
    <section
      ref={setNodeRef}
      aria-label={`${info.titulo}: ${total}`}
      className={cn(
        "flex w-72 shrink-0 snap-start flex-col rounded-xl border border-border bg-muted/40 transition-colors",
        isOver && "border-primary bg-primary-soft/40",
      )}
    >
      <header className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <span className={cn("h-2 w-2 rounded-full", info.punto)} aria-hidden /> {info.titulo}
            <span className="cifra text-xs font-medium text-muted-foreground">{total}</span>
          </h3>
          <p className="truncate text-[11px] text-muted-foreground">{etapa === "compro" && valor ? bs(valor) : info.ayuda}</p>
        </div>
      </header>
      <div className="flex min-h-[8rem] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2" style={{ maxHeight: "calc(100vh - 20rem)" }}>
        {leads.map((l) => (
          <Arrastrable key={l.id} lead={l} habilitado={habilitada} onAbrir={() => onAbrir(l.id)} />
        ))}
        {!leads.length && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Nadie acá</p>}
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
  return (
    <button
      type="button"
      onClick={onAbrir}
      className={cn(
        "w-full rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        flotando && "rotate-1 shadow-lg",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-semibold">{nombre}</span>
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground">{haceCuanto(c.lastMessageAt ?? lead.etapaAt)}</span>
      </div>
      {c.lastMessageText && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.lastMessageText}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {lead.anuncio && (
          <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 dark:bg-sky-900/30 dark:text-sky-300">
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
        {c.unreadCount > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">{c.unreadCount}</span>
        )}
      </div>
    </button>
  );
}

