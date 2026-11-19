import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Brain,
  ChevronDown,
  Clock,
  Copy,
  Loader2,
  Lock,
  Megaphone,
  MessageCircle,
  Pencil,
  RefreshCw,
  Send,
  ShoppingCart,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/collapsible";
import { Textarea } from "@/shared/ui/textarea";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/cn";
import { useStore } from "@/app/providers/auth";
import { useAnalisisLead, useEditarLead, useLead } from "@/entities/marketing/api";
import {
  CAUSA_EVENTO,
  ETAPAS,
  ETAPA_INFO,
  MOTIVOS_A_MANO,
  MOTIVO_PERDIDO,
  bs,
  type AnalisisLead,
  type Etapa,
  type EventoLead,
  type Lead,
} from "@/entities/marketing/model/types";
import { useEquipo } from "@/features/equipo/api";
import { useChat } from "@/features/whatsapp/chat/model/useChat";
import { ChatView } from "@/features/whatsapp/chat/ui/ChatView";
import { nombreDelAnuncio } from "@/features/whatsapp/chat/ui/AnuncioDeOrigen";
import { ETAPA_ESTILO, RESPUESTAS_RAPIDAS, completarTexto, primerNombre } from "../model/etapas-ui";
import { MedidorProbabilidad } from "./Probabilidad";

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-BO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const hora = (iso: string) => new Date(iso).toLocaleString("es-BO", { weekday: "short", hour: "2-digit", minute: "2-digit" });

/**
 * El espacio de trabajo con una persona: su chat de WhatsApp (solo ese) y, al
 * lado, su ficha: qué tan probable es que compre y por qué, qué escribirle
 * ahora (con IA), respuestas rápidas según la etapa y sus datos.
 */
export function EspacioCliente({
  storeId,
  leadId,
  onClose,
  puedeGestionar,
}: {
  storeId: string;
  leadId: string | null;
  onClose: () => void;
  puedeGestionar: boolean;
}) {
  const { data: lead } = useLead(storeId, leadId);
  const chat = useChat(leadId ? storeId : undefined);
  const [vista, setVista] = useState<"chat" | "ficha">("chat");

  const telefono = lead?.conversacion.contactPhone ?? null;
  useEffect(() => {
    if (telefono && chat.selectedPhone !== telefono) chat.setSelectedPhone(telefono);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telefono]);
  useEffect(() => setVista("chat"), [leadId]);

  const conversacion = chat.selectedConversation;
  const nombre = lead ? lead.conversacion.contactName || lead.conversacion.contactPhone : "Cargando…";

  return (
    <Dialog open={!!leadId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[92dvh] w-[calc(100%-1rem)] max-w-[80rem] flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100%-2rem)]">
        <DialogTitle className="sr-only">Chat con {nombre}</DialogTitle>
        <DialogDescription className="sr-only">El chat de WhatsApp y la ficha del cliente con sugerencias.</DialogDescription>

        {/* En el teléfono: chat o ficha, una a la vez. */}
        <div className="flex shrink-0 gap-1 border-b border-border p-2 pr-12 lg:hidden">
          {(["chat", "ficha"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              className={cn(
                "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                vista === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {v === "chat" ? "Chat" : "Ficha y sugerencias"}
            </button>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_26rem]">
          <div className={cn("min-h-0 flex-col border-border lg:flex lg:border-r", vista === "chat" ? "flex" : "hidden")}>
            {conversacion ? (
              <ChatView
                storeId={storeId}
                conversation={conversacion}
                messages={chat.messages}
                loading={chat.loadingMessages}
                sending={chat.sending}
                togglingAi={chat.togglingAi}
                botTyping={chat.botTyping}
                onSend={chat.send}
                onToggleAi={chat.toggleAi}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Cargando el chat…
              </div>
            )}
          </div>
          <aside className={cn("min-h-0 overflow-y-auto bg-muted/30 lg:block", vista === "ficha" ? "block" : "hidden")}>
            {lead ? (
              <PanelCliente
                storeId={storeId}
                lead={lead}
                puedeGestionar={puedeGestionar}
                onEnviar={async (texto) => {
                  await chat.send(texto);
                  toast.success("Mensaje enviado");
                  setVista("chat");
                }}
                enviando={chat.sending}
              />
            ) : (
              <div className="space-y-3 p-5">
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-40 rounded-2xl" />
                <Skeleton className="h-56 rounded-2xl" />
              </div>
            )}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------ la ficha

function PanelCliente({
  storeId,
  lead,
  puedeGestionar,
  onEnviar,
  enviando,
}: {
  storeId: string;
  lead: Lead & { historial?: EventoLead[] };
  puedeGestionar: boolean;
  onEnviar: (texto: string) => Promise<void>;
  enviando: boolean;
}) {
  const { selectedStore } = useStore();
  const tienda = selectedStore && selectedStore !== "all" ? selectedStore.name : "la tienda";
  const analisis = useAnalisisLead(storeId, lead.id);
  const editar = useEditarLead(storeId);
  const equipo = useEquipo();
  const [borrador, setBorrador] = useState("");
  const nombre = primerNombre(lead.conversacion.contactName);
  const estilo = ETAPA_ESTILO[lead.etapa];

  // La ventana de 24 h: la del análisis, o calculada con el último mensaje de la persona.
  const ventana = useMemo(() => {
    if (analisis.data) return analisis.data.ventana;
    const ultimo = lead.ultimoEntranteAt;
    if (!ultimo) return { abierta: false, cierraEn: null, ultimoMensajeCliente: null };
    const cierra = new Date(ultimo).getTime() + 24 * 3_600_000;
    return { abierta: cierra > Date.now(), cierraEn: new Date(cierra).toISOString(), ultimoMensajeCliente: ultimo };
  }, [analisis.data, lead.ultimoEntranteAt]);
  const puedeEscribir = puedeGestionar && ventana.abierta;

  const guardar = async (cambios: { etapa?: string; motivo?: string; notas?: string | null; valor?: number | null; responsableId?: string | null }) => {
    try {
      await editar.mutateAsync({ id: lead.id, ...cambios });
      toast.success("Guardado");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar");
    }
  };

  const enviar = async (texto: string) => {
    if (!texto.trim()) return;
    try {
      await onEnviar(texto.trim());
      setBorrador("");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo enviar");
    }
  };

  return (
    <div className="space-y-3 p-4 pr-4 lg:pt-12">
      {/* Quién es y dónde está */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", estilo.chip)}>
            <estilo.icono className="h-3 w-3" /> {ETAPA_INFO[lead.etapa].titulo}
          </span>
          {lead.anuncio ? (
            <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-info-soft px-2 py-0.5 text-xs font-medium text-info-soft-foreground">
              <Megaphone className="h-3 w-3 shrink-0" />
              <span className="truncate">{nombreDelAnuncio(lead.anuncio)}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <MessageCircle className="h-3 w-3" /> Escribió directo
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {lead.conversacion.contactPhone} · llegó {fecha(lead.abiertoAt)}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="ec-etapa" className="text-xs">Etapa</Label>
            <Select
              value={lead.etapa}
              disabled={!puedeGestionar || editar.isPending}
              onValueChange={(v) => guardar({ etapa: v, motivo: v === "perdido" ? "otro" : undefined })}
            >
              <SelectTrigger id="ec-etapa" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ETAPAS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {ETAPA_INFO[e].titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ec-responsable" className="text-xs">La atiende</Label>
            <Select
              value={lead.responsable?.id ?? "nadie"}
              disabled={!puedeGestionar}
              onValueChange={(v) => guardar({ responsableId: v === "nadie" ? null : v })}
            >
              <SelectTrigger id="ec-responsable" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nadie">Nadie en particular</SelectItem>
                {lead.responsable && !(equipo.data?.miembros ?? []).some((m) => m.id === lead.responsable!.id) && (
                  <SelectItem value={lead.responsable.id}>{lead.responsable.nombre}</SelectItem>
                )}
                {(equipo.data?.miembros ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name || m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {lead.etapa === "perdido" && (
          <div className="mt-2 space-y-1">
            <Label htmlFor="ec-motivo" className="text-xs">Por qué se perdió</Label>
            <Select value={lead.motivoPerdido ?? "otro"} disabled={!puedeGestionar} onValueChange={(v) => guardar({ etapa: "perdido", motivo: v })}>
              <SelectTrigger id="ec-motivo" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...new Set([lead.motivoPerdido ?? "otro", ...MOTIVOS_A_MANO])].map((m) => (
                  <SelectItem key={m} value={m}>
                    {MOTIVO_PERDIDO[m as keyof typeof MOTIVO_PERDIDO]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </section>

      {/* Probabilidad de compra */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
          <Brain className="h-4 w-4 text-primary" /> ¿Va a comprar?
        </h3>
        {analisis.isError ? (
          <ErrorAnalisis onReintentar={() => analisis.refetch()} />
        ) : analisis.isLoading || !analisis.data ? (
          <div className="flex items-center gap-4">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          </div>
        ) : (
          <Probabilidad a={analisis.data} etapa={lead.etapa} />
        )}
      </section>

      {/* Qué hacer y qué escribirle */}
      <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary-soft/60 to-card p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> Qué hacer ahora
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={analisis.regenerar.isPending || analisis.isLoading}
            onClick={() => analisis.regenerar.mutate()}
            title="Pedirle a la IA sugerencias nuevas"
          >
            <RefreshCw className={cn("mr-1 h-3.5 w-3.5", analisis.regenerar.isPending && "animate-spin")} /> Otras ideas
          </Button>
        </div>
        {analisis.isError ? (
          <ErrorAnalisis onReintentar={() => analisis.refetch()} />
        ) : analisis.isLoading || !analisis.data ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : (
          <>
            <p className="text-sm font-medium">{analisis.data.siguientePaso}</p>
            {analisis.data.resumen && <p className="mt-1 text-xs text-muted-foreground">{analisis.data.resumen}</p>}

            <Ventana abierta={ventana.abierta} cierraEn={ventana.cierraEn} />

            <ul className="mt-3 space-y-2">
              {analisis.data.sugerencias.map((s, i) => (
                <li key={i} className="rounded-xl border border-border bg-card p-3 shadow-sm">
                  <p className="text-xs font-semibold text-primary">{s.titulo}</p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-snug">{s.texto}</p>
                  {s.motivo && <p className="mt-1 text-[11px] text-muted-foreground">{s.motivo}</p>}
                  <div className="mt-2 flex gap-1.5">
                    <Button size="sm" className="h-7 px-2.5 text-xs" disabled={!puedeEscribir || enviando} onClick={() => enviar(s.texto)}>
                      <Send className="mr-1 h-3 w-3" /> Enviar
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" disabled={!puedeGestionar} onClick={() => setBorrador(s.texto)}>
                      <Pencil className="mr-1 h-3 w-3" /> Editar
                    </Button>
                    {!ventana.abierta && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2.5 text-xs"
                        onClick={() => navigator.clipboard?.writeText(s.texto).then(() => toast.success("Copiado"))}
                      >
                        <Copy className="mr-1 h-3 w-3" /> Copiar
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {analisis.data.generadoCon === "ia" ? "Sugerido con IA a partir de la conversación y tus productos." : "Sugerencias según la etapa (la IA no respondió)."}
            </p>
          </>
        )}

        {/* Respuestas rápidas por etapa */}
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Respuestas rápidas</p>
          <div className="flex flex-wrap gap-1.5">
            {RESPUESTAS_RAPIDAS[lead.etapa].map((r) => (
              <button
                key={r.titulo}
                type="button"
                disabled={!puedeGestionar}
                onClick={() => setBorrador(completarTexto(r.texto, tienda, nombre))}
                className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium transition-colors hover:border-primary/50 hover:bg-primary-soft/40 disabled:opacity-50"
              >
                {r.titulo}
              </button>
            ))}
          </div>
        </div>

        {/* Lo que se va a enviar */}
        {borrador !== "" && (
          <div className="mt-3 space-y-2">
            <Label htmlFor="ec-borrador" className="text-xs">Mensaje para {nombre ?? "esta persona"}</Label>
            <Textarea id="ec-borrador" rows={4} value={borrador} onChange={(e) => setBorrador(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" disabled={!puedeEscribir || enviando || !borrador.trim()} onClick={() => enviar(borrador)}>
                {enviando ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />} Enviar por WhatsApp
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setBorrador("")}>
                Descartar
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Sus datos */}
      <DatosCliente lead={lead} a={analisis.data} puedeGestionar={puedeGestionar} onGuardar={guardar} />
    </div>
  );
}

function ErrorAnalisis({ onReintentar }: { onReintentar: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
      No se pudo calcular ahora.
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onReintentar}>
        Reintentar
      </Button>
    </div>
  );
}

function Probabilidad({ a, etapa }: { a: AnalisisLead; etapa: Etapa }) {
  if (etapa === "compro") {
    return <p className="text-sm text-muted-foreground">Ya compró. Lo que sigue es que vuelva: agradécele y ofrécele algo relacionado.</p>;
  }
  const max = Math.max(...a.factores.map((f) => Math.abs(f.peso)), 0.1);
  return (
    <div className="flex gap-4">
      <MedidorProbabilidad p={a.probabilidad} nivel={a.nivel} />
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Por qué</p>
        <ul className="space-y-1.5">
          {a.factores.map((f) => (
            <li key={f.clave} className="text-xs">
              <div className="flex items-center gap-1.5">
                {f.efecto === "sube" ? (
                  <ArrowUp className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <ArrowDown className="h-3 w-3 shrink-0 text-rose-600 dark:text-rose-400" />
                )}
                <span className="leading-tight">{f.texto}</span>
              </div>
              <div className="ml-[18px] mt-1 h-1 rounded-full bg-muted">
                <div
                  className={cn("h-1 rounded-full", f.efecto === "sube" ? "bg-emerald-500" : "bg-rose-500")}
                  style={{ width: `${(Math.abs(f.peso) / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
          {!a.factores.length && <li className="text-xs text-muted-foreground">Todavía hay pocas señales en la conversación.</li>}
        </ul>
        <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
          {a.modelo.fuente === "entrenado"
            ? `Modelo entrenado con ${a.modelo.muestras} chats cerrados de verdad.`
            : `Modelo de partida: aprende solo con tus ventas cuando haya suficientes chats cerrados (hoy ${a.modelo.muestras}).`}
        </p>
      </div>
    </div>
  );
}

function Ventana({ abierta, cierraEn }: { abierta: boolean; cierraEn: string | null }) {
  if (abierta) {
    return (
      <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-success-soft px-2.5 py-1.5 text-[11px] text-success-soft-foreground">
        <Clock className="h-3.5 w-3.5 shrink-0" /> Puedes escribirle hasta el {cierraEn ? hora(cierraEn) : "final del día"} (24 h desde su último mensaje).
      </p>
    );
  }
  return (
    <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-warning-soft px-2.5 py-1.5 text-[11px] text-warning-soft-foreground">
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      Pasaron más de 24 h desde su último mensaje: WhatsApp solo deja escribirle con una plantilla aprobada por Meta. Puedes copiar el texto o esperar a que vuelva a escribir.
    </p>
  );
}

function DatosCliente({
  lead,
  a,
  puedeGestionar,
  onGuardar,
}: {
  lead: Lead & { historial?: EventoLead[] };
  a?: AnalisisLead;
  puedeGestionar: boolean;
  onGuardar: (c: { notas?: string | null; valor?: number | null }) => Promise<void>;
}) {
  const [notas, setNotas] = useState(lead.notas ?? "");
  const [valor, setValor] = useState(lead.valor != null ? String(lead.valor) : "");
  useEffect(() => {
    setNotas(lead.notas ?? "");
    setValor(lead.valor != null ? String(lead.valor) : "");
  }, [lead.id, lead.notas, lead.valor]);

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <UserRound className="h-4 w-4 text-muted-foreground" /> Sus datos
      </h3>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-muted/60 p-2">
          <dt className="text-[10px] text-muted-foreground">Compras</dt>
          <dd className="cifra text-base font-bold">{a ? a.cliente.compras : "—"}</dd>
        </div>
        <div className="rounded-xl bg-muted/60 p-2">
          <dt className="text-[10px] text-muted-foreground">Gastó</dt>
          <dd className="cifra text-base font-bold">{a ? bs(a.cliente.gastado) : "—"}</dd>
        </div>
        <div className="rounded-xl bg-muted/60 p-2">
          <dt className="text-[10px] text-muted-foreground">Última</dt>
          <dd className="text-xs font-semibold">{a?.cliente.ultimaCompra ? new Date(a.cliente.ultimaCompra).toLocaleDateString("es-BO") : "—"}</dd>
        </div>
      </dl>

      {lead.pedido ? (
        <Link to="/orders" className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted/60">
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          Pedido #{lead.pedido.numero} · {bs(lead.pedido.total)} · {lead.pedido.estado}
        </Link>
      ) : (
        <div className="space-y-1">
          <Label htmlFor="ec-valor" className="text-xs">Valor (si compró sin pedido)</Label>
          <div className="flex gap-2">
            <Input id="ec-valor" type="number" inputMode="decimal" min={0} className="h-9" value={valor} disabled={!puedeGestionar} onChange={(e) => setValor(e.target.value)} />
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={!puedeGestionar || valor === (lead.valor != null ? String(lead.valor) : "")}
              onClick={() => onGuardar({ valor: valor === "" ? null : Number(valor) })}
            >
              Guardar
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="ec-notas" className="text-xs">Notas</Label>
        <Textarea
          id="ec-notas"
          rows={2}
          value={notas}
          disabled={!puedeGestionar}
          placeholder="Lo que pidió, cuándo volver a escribirle…"
          onChange={(e) => setNotas(e.target.value)}
        />
        {notas !== (lead.notas ?? "") && (
          <Button size="sm" variant="outline" disabled={!puedeGestionar} onClick={() => onGuardar({ notas: notas.trim() || null })}>
            Guardar nota
          </Button>
        )}
      </div>

      {!!lead.historial?.length && (
        <Collapsible>
          <CollapsibleTrigger className="group flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground">
            Cómo avanzó ({lead.historial.length})
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ol className="mt-2 space-y-2 border-l border-border pl-3 text-xs">
              {lead.historial.map((h, i) => (
                <li key={i}>
                  <span className="font-medium">{ETAPA_INFO[h.a]?.titulo ?? h.a}</span>{" "}
                  <span className="text-muted-foreground">
                    · {CAUSA_EVENTO[h.causa] ?? h.causa}
                    {h.usuario ? ` (${h.usuario})` : ""} · {fecha(h.at)}
                  </span>
                </li>
              ))}
            </ol>
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  );
}
