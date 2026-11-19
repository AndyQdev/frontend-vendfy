import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Bot, Check, ChevronDown, FlaskConical, Link2, Megaphone, MessageCircle, Plug, Rocket, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/shared/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/collapsible";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { cn } from "@/shared/lib/cn";
import { useAcceso } from "@/app/providers/acceso";
import { PERMISO } from "@/shared/acceso/permisos";
import { useKapsoProvision, useKapsoStatus } from "@/entities/whatsapp/api/inbox";
import { useAgentConfig } from "@/entities/whatsapp/api/agent";
import { useIntegrations } from "@/entities/integration/api";
import { IntegrationCard } from "@/features/integrations/ui/IntegrationCard";
import { AdLinksTable } from "@/features/integrations/ui/AdLinksTable";
import type { ConfigTab } from "@/features/whatsapp/config/ui/WhatsAppConfigModal";

export type EstadoWhatsapp = "conectado" | "pendiente" | "no";
export type EstadoMeta = "conectado" | "sin_cuenta" | "error" | "no";

/** Qué está conectado en la tienda: WhatsApp, el agente y Meta. */
export function useEstadoConexiones(storeId?: string) {
  const acceso = useAcceso();
  const conWhatsapp = acceso.tiene("whatsapp");
  const conAnuncios = acceso.tiene("anuncios_meta");
  const kapso = useKapsoStatus(conWhatsapp ? storeId : undefined);
  const agente = useAgentConfig(conWhatsapp ? storeId : undefined);
  const integraciones = useIntegrations(conAnuncios ? storeId : undefined);
  const meta = integraciones.data?.find((c) => c.provider === "meta");

  const whatsapp: EstadoWhatsapp = kapso.data?.status === "connected" ? "conectado" : kapso.data?.status === "pending" ? "pendiente" : "no";
  const estadoMeta: EstadoMeta =
    meta?.status === "connected" ? (meta.adAccountId ? "conectado" : "sin_cuenta") : meta?.status === "error" || meta?.status === "expired" ? "error" : "no";

  return {
    conWhatsapp,
    conAnuncios,
    whatsapp,
    numero: kapso.data?.display_phone_number ?? null,
    agente: !!agente.data?.enabled,
    meta: estadoMeta,
    metaConexion: meta,
    cargando: kapso.isLoading || integraciones.isLoading,
  };
}

const PUNTO: Record<string, string> = {
  conectado: "bg-emerald-500",
  pendiente: "bg-amber-500",
  sin_cuenta: "bg-amber-500",
  error: "bg-rose-500",
  no: "bg-slate-400",
};

/** Los chips del encabezado: de un vistazo, qué está conectado. Al tocarlos se abre el panel. */
export function ChipsConexion({ storeId, onAbrir }: { storeId: string; onAbrir: () => void }) {
  const e = useEstadoConexiones(storeId);
  const chips = [
    e.conWhatsapp && { k: "wa", icono: MessageCircle, texto: "WhatsApp", estado: e.whatsapp },
    e.conWhatsapp && { k: "ia", icono: Bot, texto: "Agente IA", estado: e.agente ? "conectado" : "no" },
    e.conAnuncios && { k: "meta", icono: Megaphone, texto: "Meta", estado: e.meta },
  ].filter(Boolean) as Array<{ k: string; icono: typeof Bot; texto: string; estado: string }>;
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="flex items-center gap-1 rounded-2xl border border-border bg-card p-1 shadow-sm transition-colors hover:border-primary/40"
      aria-label="Conexiones del módulo"
    >
      {chips.map((c) => (
        <span key={c.k} className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium">
          <c.icono className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="hidden sm:inline">{c.texto}</span>
          <span className={cn("h-2 w-2 rounded-full", PUNTO[c.estado])} aria-label={c.estado} />
        </span>
      ))}
      <span className="inline-flex items-center gap-1 rounded-xl bg-muted px-2.5 py-1.5 text-xs font-medium">
        <Plug className="h-3.5 w-3.5" /> <span className="hidden md:inline">Conexiones</span>
      </span>
    </button>
  );
}

/**
 * El mini onboarding: lo que falta para que el módulo funcione, en orden. Se
 * va solo cuando todo está listo (o si el dueño lo oculta).
 */
export function OnboardingModulo({
  storeId,
  hayCampanas,
  onConfigWhatsapp,
  onConexiones,
  onNuevaCampana,
}: {
  storeId: string;
  hayCampanas: boolean;
  onConfigWhatsapp: (tab: ConfigTab) => void;
  onConexiones: () => void;
  onNuevaCampana: () => void;
}) {
  const e = useEstadoConexiones(storeId);
  const clave = `vendfy:marketing:onboarding-oculto:${storeId}`;
  const [oculto, setOculto] = useState(() => {
    try {
      return localStorage.getItem(clave) === "1";
    } catch {
      return false;
    }
  });

  const pasos = [
    e.conWhatsapp && {
      titulo: "Conecta tu WhatsApp",
      texto: "Es donde te escriben los clientes. Puedes usar tu número actual sin perder tus chats.",
      hecho: e.whatsapp === "conectado",
      accion: e.whatsapp === "pendiente" ? "Terminar" : "Conectar",
      onClick: () => onConfigWhatsapp("connection"),
    },
    e.conWhatsapp && {
      titulo: "Prende el agente IA",
      texto: "Responde al instante, con tu catálogo y tus precios, a cualquier hora.",
      hecho: e.agente,
      accion: "Configurar",
      onClick: () => onConfigWhatsapp("agent"),
    },
    e.conAnuncios && {
      titulo: "Conecta Meta (Facebook e Instagram)",
      texto: "Para crear las campañas desde aquí y medir cuánto vuelve de cada una.",
      hecho: e.meta === "conectado",
      accion: e.meta === "sin_cuenta" ? "Elegir cuenta" : e.meta === "error" ? "Reconectar" : "Conectar",
      onClick: onConexiones,
    },
    e.conAnuncios && {
      titulo: "Crea tu primera campaña",
      texto: "Vendfy te propone ideas con tus datos y te dice cuánto invertir y qué esperar.",
      hecho: hayCampanas,
      accion: "Ver ideas",
      onClick: onNuevaCampana,
    },
  ].filter(Boolean) as Array<{ titulo: string; texto: string; hecho: boolean; accion: string; onClick: () => void }>;

  const hechos = pasos.filter((p) => p.hecho).length;
  if (e.cargando || oculto || !pasos.length || hechos === pasos.length) return null;
  const siguiente = pasos.findIndex((p) => !p.hecho);

  return (
    <Card className="relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-2xl" aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-sm" style={{ background: "var(--primary-grad)" }}>
            <Rocket className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold">Deja listo tu módulo</h2>
            <p className="text-xs text-muted-foreground">
              {hechos} de {pasos.length} listos · todo se conecta solo después
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          aria-label="Ocultar"
          onClick={() => {
            setOculto(true);
            try {
              localStorage.setItem(clave, "1");
            } catch {
              /* sin almacenamiento: se oculta hasta recargar */
            }
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-muted">
        <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${(hechos / pasos.length) * 100}%` }} />
      </div>
      <ol className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {pasos.map((p, i) => (
          <li
            key={p.titulo}
            className={cn(
              "flex flex-col gap-2 rounded-xl border p-3",
              p.hecho ? "border-success/30 bg-success-soft/40" : i === siguiente ? "border-primary/40 bg-primary-soft/30" : "border-border",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  p.hecho ? "bg-success text-success-foreground" : i === siguiente ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {p.hecho ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <p className="text-sm font-semibold leading-tight">{p.titulo}</p>
            </div>
            <p className="text-xs text-muted-foreground">{p.texto}</p>
            {!p.hecho && (
              <Button size="sm" variant={i === siguiente ? "default" : "outline"} className="mt-auto self-start" onClick={p.onClick}>
                {p.accion}
              </Button>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** Todas las conexiones del módulo en un solo panel lateral. */
export function PanelConexiones({
  storeId,
  open,
  onOpenChange,
  onConfigWhatsapp,
  onProbarAgente,
}: {
  storeId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfigWhatsapp: (tab: ConfigTab) => void;
  onProbarAgente: () => void;
}) {
  const e = useEstadoConexiones(storeId);
  const puedeConfigurar = useAcceso().puede(PERMISO.GESTIONAR_TIENDAS);
  const integraciones = useIntegrations(e.conAnuncios ? storeId : undefined);
  const conexion = (p: "meta" | "tiktok" | "google") => integraciones.data?.find((c) => c.provider === p);
  const metaListo = e.meta === "conectado";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="text-left">
          <SheetTitle>Conexiones</SheetTitle>
          <SheetDescription>Lo que hace funcionar el módulo: tu WhatsApp, el agente que responde y tu cuenta de anuncios.</SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          {e.conWhatsapp && (
            <section className="space-y-3 rounded-2xl border border-border p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366]/15 text-[#128C7E] dark:text-[#25D366]">
                  <MessageCircle className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">WhatsApp</h3>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn("h-2 w-2 rounded-full", PUNTO[e.whatsapp])} />
                    {e.whatsapp === "conectado" ? `Conectado${e.numero ? ` · ${e.numero}` : ""}` : e.whatsapp === "pendiente" ? "Falta terminar en Meta" : "Sin conectar"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" disabled={!puedeConfigurar} onClick={() => onConfigWhatsapp("connection")}>
                  <Link2 className="mr-1.5 h-3.5 w-3.5" /> Conexión
                </Button>
                <Button variant="outline" size="sm" disabled={!puedeConfigurar} onClick={() => onConfigWhatsapp("notifications")}>
                  <Bell className="mr-1.5 h-3.5 w-3.5" /> Avisos automáticos
                </Button>
                <Button variant="outline" size="sm" disabled={!puedeConfigurar} onClick={() => onConfigWhatsapp("agent")}>
                  <Bot className="mr-1.5 h-3.5 w-3.5" /> Agente IA {e.agente ? "· prendido" : "· apagado"}
                </Button>
                <Button variant="outline" size="sm" onClick={onProbarAgente}>
                  <FlaskConical className="mr-1.5 h-3.5 w-3.5" /> Probar el agente
                </Button>
              </div>
            </section>
          )}

          {e.conAnuncios && (
            <section className="space-y-3">
              <IntegrationCard provider="meta" storeId={storeId} connection={conexion("meta")} />
              {metaListo && (
                <Collapsible>
                  <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-sm font-medium hover:bg-muted/50">
                    Tus anuncios y el producto de cada uno
                    <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    <p className="mb-2 text-xs text-muted-foreground">
                      Si le dices qué producto vende cada anuncio, el agente abre la conversación hablando de ese producto.
                    </p>
                    <AdLinksTable storeId={storeId} moneda={e.metaConexion?.currency || "Bs"} />
                  </CollapsibleContent>
                </Collapsible>
              )}
              <Collapsible>
                <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-sm font-medium hover:bg-muted/50">
                  Otras plataformas (TikTok, Google Ads)
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-3">
                  <IntegrationCard provider="tiktok" storeId={storeId} connection={conexion("tiktok")} />
                  <IntegrationCard provider="google" storeId={storeId} connection={conexion("google")} />
                </CollapsibleContent>
              </Collapsible>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Los regresos de Kapso (?success / ?error) y de Meta (?meta), y los enlaces
 * directos (?config=…, ?conexiones=1) que antes iban a WhatsApp o a
 * Integraciones.
 */
export function useRegresosDeConexion({
  storeId,
  onConfigWhatsapp,
  onConexiones,
}: {
  storeId?: string;
  onConfigWhatsapp: (tab: ConfigTab) => void;
  onConexiones: () => void;
}) {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const provision = useKapsoProvision();
  const aprovisionado = useRef(false);

  useEffect(() => {
    if (!storeId) return;
    let cambio = false;
    const quitar = (...k: string[]) => {
      k.forEach((x) => params.delete(x));
      cambio = true;
    };

    if (params.get("success") === "true" || params.get("status") === "completed") {
      qc.invalidateQueries({ queryKey: ["kapso-status", storeId] });
      toast.success("¡Número de WhatsApp vinculado!", { description: "Estamos creando tus plantillas de mensajes automáticos…" });
      if (!aprovisionado.current) {
        aprovisionado.current = true;
        // El webhook de Kapso también aprovisiona; esto es un respaldo idempotente.
        setTimeout(() => provision.mutate({ storeId }), 4000);
      }
      onConfigWhatsapp("notifications");
      quitar("success", "store_id", "status", "business_account_id", "phone_number_id", "setup_link_id", "whatsapp_config_id");
    }
    if (params.get("error") === "connection_failed") {
      toast.error("La conexión con Meta no se completó", { description: "Puedes intentarlo de nuevo desde Conexiones." });
      quitar("error", "store_id");
    }
    const config = params.get("config");
    if (config === "notifications" || config === "connection" || config === "agent") {
      onConfigWhatsapp(config);
      quitar("config");
    }
    const meta = params.get("meta");
    if (meta) {
      if (meta === "ok") toast.success("Meta conectado correctamente");
      else toast.error("No se pudo conectar Meta", { description: params.get("detalle") ?? undefined });
      qc.invalidateQueries({ queryKey: ["integrations"] });
      onConexiones();
      quitar("meta", "detalle");
    }
    if (params.get("conexiones")) {
      onConexiones();
      quitar("conexiones");
    }
    if (cambio) setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, storeId]);
}
