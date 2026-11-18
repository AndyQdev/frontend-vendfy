import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Megaphone, ShoppingCart } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/shared/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Button } from "@/shared/ui/button";
import { useEditarLead, useLead } from "@/entities/marketing/api";
import { CAUSA_EVENTO, ETAPAS, ETAPA_INFO, MOTIVOS_A_MANO, MOTIVO_PERDIDO, bs, type Etapa } from "@/entities/marketing/model/types";
import { useEquipo } from "@/features/equipo/api";
import { useChat } from "@/features/whatsapp/chat/model/useChat";
import { ChatView } from "@/features/whatsapp/chat/ui/ChatView";
import { AvisoAnuncio } from "@/features/whatsapp/chat/ui/AnuncioDeOrigen";

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-BO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** La ficha de una persona del tablero: su etapa, quién la atiende, notas, historia y el chat. */
export function FichaLead({
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
  const { data: lead, isLoading } = useLead(storeId, leadId);
  const editar = useEditarLead(storeId);
  const equipo = useEquipo();
  const chat = useChat(leadId ? storeId : undefined);
  const [notas, setNotas] = useState("");
  const [valor, setValor] = useState("");

  const telefono = lead?.conversacion.contactPhone ?? null;
  useEffect(() => {
    if (telefono && chat.selectedPhone !== telefono) chat.setSelectedPhone(telefono);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telefono]);
  useEffect(() => {
    setNotas(lead?.notas ?? "");
    setValor(lead?.valor != null ? String(lead.valor) : "");
  }, [lead?.id, lead?.notas, lead?.valor]);

  const guardar = async (cambios: { etapa?: string; motivo?: string; notas?: string | null; valor?: number | null; responsableId?: string | null }) => {
    if (!lead) return;
    try {
      await editar.mutateAsync({ id: lead.id, ...cambios });
      toast.success("Guardado");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar");
    }
  };

  const conversacion = chat.selectedConversation;
  const miembros = equipo.data?.miembros ?? [];

  return (
    <Sheet open={!!leadId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-4xl">
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle>{lead ? lead.conversacion.contactName || lead.conversacion.contactPhone : "Cargando…"}</SheetTitle>
          <SheetDescription>
            {lead ? `${lead.conversacion.contactPhone} · llegó ${fecha(lead.abiertoAt)}` : " "}
          </SheetDescription>
        </SheetHeader>

        {isLoading || !lead ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 lg:grid-cols-[19rem_1fr]">
            <aside className="space-y-4 overflow-y-auto border-b border-border p-5 lg:border-b-0 lg:border-r">
              <div className="space-y-1.5">
                <Label htmlFor="lead-etapa">Etapa</Label>
                <Select
                  value={lead.etapa}
                  disabled={!puedeGestionar || editar.isPending}
                  onValueChange={(v) => guardar({ etapa: v, motivo: v === "perdido" ? "otro" : undefined })}
                >
                  <SelectTrigger id="lead-etapa">
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
                <p className="text-xs text-muted-foreground">
                  {lead.etapaManual ? "Movida a mano: el sistema no la retrocede sola." : ETAPA_INFO[lead.etapa].ayuda}
                </p>
              </div>

              {lead.etapa === "perdido" && (
                <div className="space-y-1.5">
                  <Label htmlFor="lead-motivo">Motivo</Label>
                  <Select
                    value={lead.motivoPerdido ?? "otro"}
                    disabled={!puedeGestionar}
                    onValueChange={(v) => guardar({ etapa: "perdido", motivo: v })}
                  >
                    <SelectTrigger id="lead-motivo">
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

              <div className="space-y-1.5">
                <Label htmlFor="lead-responsable">La atiende</Label>
                <Select
                  value={lead.responsable?.id ?? "nadie"}
                  disabled={!puedeGestionar}
                  onValueChange={(v) => guardar({ responsableId: v === "nadie" ? null : v })}
                >
                  <SelectTrigger id="lead-responsable">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nadie">Nadie en particular</SelectItem>
                    {lead.responsable && !miembros.some((m) => m.id === lead.responsable!.id) && (
                      <SelectItem value={lead.responsable.id}>{lead.responsable.nombre}</SelectItem>
                    )}
                    {miembros.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name || m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {lead.pedido ? (
                <Link
                  to="/orders"
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/60"
                >
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  Pedido #{lead.pedido.numero} · {bs(lead.pedido.total)} · {lead.pedido.estado}
                </Link>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="lead-valor">Valor (si compró sin pedido)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="lead-valor"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={valor}
                      disabled={!puedeGestionar}
                      onChange={(e) => setValor(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      disabled={!puedeGestionar || valor === (lead.valor != null ? String(lead.valor) : "")}
                      onClick={() => guardar({ valor: valor === "" ? null : Number(valor) })}
                    >
                      Guardar
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="lead-notas">Notas</Label>
                <Textarea
                  id="lead-notas"
                  rows={3}
                  value={notas}
                  disabled={!puedeGestionar}
                  placeholder="Lo que pidió, cuándo volver a escribirle…"
                  onChange={(e) => setNotas(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!puedeGestionar || notas === (lead.notas ?? "")}
                  onClick={() => guardar({ notas: notas.trim() || null })}
                >
                  Guardar nota
                </Button>
              </div>

              <div>
                <h4 className="etiqueta mb-2 text-muted-foreground">Cómo avanzó</h4>
                <ol className="space-y-2 border-l border-border pl-3 text-xs">
                  {(lead as any).historial?.map((h: any, i: number) => (
                    <li key={i}>
                      <span className="font-medium">{ETAPA_INFO[h.a as Etapa]?.titulo ?? h.a}</span>{" "}
                      <span className="text-muted-foreground">
                        · {CAUSA_EVENTO[h.causa] ?? h.causa}
                        {h.usuario ? ` (${h.usuario})` : ""} · {fecha(h.at)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </aside>

            <div className="flex min-h-[28rem] flex-col">
              {lead.anuncio && !conversacion && (
                <div className="border-b border-border">
                  <AvisoAnuncio anuncio={lead.anuncio} />
                </div>
              )}
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
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
                  <Megaphone className="h-6 w-6" />
                  Cargando el chat…
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
