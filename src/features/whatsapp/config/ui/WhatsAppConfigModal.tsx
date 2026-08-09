import { useEffect, useState } from "react";
import {
  Bell,
  Bot,
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn";
import {
  useKapsoConnect,
  useKapsoSetupLink,
  useKapsoStatus,
} from "@/entities/whatsapp/api/inbox";
import { NotificationsPanel } from "./NotificationsPanel";
import { AgentPanel } from "./AgentPanel";

export type ConfigTab = "connection" | "notifications" | "agent";

/**
 * Modal de configuración de WhatsApp:
 *  - Conexión: línea de tiempo del vínculo con Meta vía Kapso (toma tiempo).
 *  - Notificaciones: los templates automáticos (el core del sistema).
 */
export function WhatsAppConfigModal({
  open,
  onOpenChange,
  storeId,
  initialTab = "connection",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  initialTab?: ConfigTab;
}) {
  const [tab, setTab] = useState<ConfigTab>(initialTab);
  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  const statusQuery = useKapsoStatus(storeId);
  const status = statusQuery.data?.status;
  const connected = status === "connected";

  // Mientras el dueño completa el flujo en Meta, refrescamos el estado seguido
  useEffect(() => {
    if (!open || status !== "pending") return;
    const interval = setInterval(() => statusQuery.refetch(), 10_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, status]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Configuración de WhatsApp
          </DialogTitle>
          <DialogDescription>
            Conecta tu número y gestiona los mensajes automáticos de tu tienda.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as ConfigTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="connection" className="gap-1.5">
              <Link2 className="h-4 w-4" /> Conexión
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1.5">
              <Bell className="h-4 w-4" /> Notificaciones
            </TabsTrigger>
            <TabsTrigger value="agent" className="gap-1.5">
              <Bot className="h-4 w-4" /> Agente IA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connection" className="mt-4">
            <ConnectionTimeline storeId={storeId} />
          </TabsContent>

          <TabsContent value="notifications" className="mt-4">
            <NotificationsPanel storeId={storeId} connected={connected} />
          </TabsContent>

          <TabsContent value="agent" className="mt-4">
            <AgentPanel storeId={storeId} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------- timeline conexión

function ConnectionTimeline({ storeId }: { storeId: string }) {
  const statusQuery = useKapsoStatus(storeId);
  const connect = useKapsoConnect();
  const setupLink = useKapsoSetupLink();

  const cfg = statusQuery.data;
  // Paso actual: 1 = sin conexión, 2 = esperando Meta, 3 = conectado
  const currentStep = !cfg?.customer_id
    ? 1
    : cfg.status === "connected"
      ? 3
      : 2;

  const openSetup = (url?: string) => {
    if (url) window.open(url, "_blank", "noopener");
  };

  return (
    <div className="space-y-1">
      <TimelineStep
        number={1}
        title="Conecta tu cuenta"
        active={currentStep === 1}
        done={currentStep > 1}
        last={false}
      >
        <p className="text-sm text-muted-foreground">
          Creamos tu espacio de WhatsApp Business y te llevamos a Meta para
          vincular tu número. Puedes usar tu número actual sin perder tus chats
          (modo coexistencia).
        </p>
        {currentStep === 1 && (
          <Button
            className="mt-3"
            onClick={async () => {
              const res = await connect.mutateAsync({ storeId });
              openSetup(res?.setupUrl);
            }}
            disabled={connect.isPending}
          >
            {connect.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
            Conectar WhatsApp
          </Button>
        )}
      </TimelineStep>

      <TimelineStep
        number={2}
        title="Vincula tu número en Meta"
        active={currentStep === 2}
        done={currentStep > 2}
        last={false}
      >
        {currentStep === 2 ? (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-900/40 dark:bg-orange-900/20">
            <div className="flex items-center gap-2 text-sm font-medium text-orange-800 dark:text-orange-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Esperando que completes la configuración en Meta…
            </div>
            <p className="mt-1 text-xs text-orange-700/80 dark:text-orange-400/80">
              Sigue los pasos en la ventana que se abrió. Al terminar, esta
              pantalla se actualizará sola. Si cerraste la ventana, genera un
              nuevo enlace:
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={async () => {
                const res = await setupLink.mutateAsync({ storeId });
                openSetup(res?.setupUrl);
              }}
              disabled={setupLink.isPending}
            >
              {setupLink.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Generar nuevo enlace
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Escaneas un QR o vinculas el número desde el asistente oficial de
            Meta. Este paso puede tardar unos minutos.
          </p>
        )}
      </TimelineStep>

      <TimelineStep
        number={3}
        title="Plantillas y mensajes automáticos"
        active={currentStep === 3}
        done={false}
        last
      >
        {currentStep === 3 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
              WhatsApp conectado
              {cfg?.connected_at && (
                <span className="font-normal text-emerald-700/70 dark:text-emerald-400/70">
                  · desde {new Date(cfg.connected_at).toLocaleDateString("es-BO")}
                </span>
              )}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Smartphone className="h-3.5 w-3.5" />
              Al conectar se crearon tus plantillas automáticamente. Revisa su
              estado de aprobación en la pestaña <b>Notificaciones</b> (Meta
              tarda de minutos a 24 h en aprobarlas).
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Al conectar, creamos automáticamente tus plantillas de mensajes
            (estados del pedido, aviso de nuevos pedidos) y las enviamos a
            aprobación de Meta.
          </p>
        )}
      </TimelineStep>

      <div className="flex justify-end pt-2">
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => statusQuery.refetch()}
          disabled={statusQuery.isFetching}
        >
          <RefreshCw
            className={cn("h-4 w-4", statusQuery.isFetching && "animate-spin")}
          />
          Actualizar
        </Button>
      </div>
    </div>
  );
}

function TimelineStep({
  number,
  title,
  active,
  done,
  last,
  children,
}: {
  number: number;
  title: string;
  active: boolean;
  done: boolean;
  last: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
            done
              ? "border-emerald-500 bg-emerald-500 text-white"
              : active
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-border text-muted-foreground",
          )}
        >
          {done ? <CheckCircle2 className="h-4 w-4" /> : number}
        </div>
        {!last && (
          <div
            className={cn(
              "w-0.5 flex-1",
              done ? "bg-emerald-500" : "bg-border",
            )}
          />
        )}
      </div>
      <div className={cn("min-w-0 flex-1 pb-6", last && "pb-2")}>
        <p
          className={cn(
            "pt-1 text-sm font-semibold",
            !active && !done && "text-muted-foreground",
          )}
        >
          {title}
        </p>
        <div className="mt-1.5">{children}</div>
      </div>
    </div>
  );
}
