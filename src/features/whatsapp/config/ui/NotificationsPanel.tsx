import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Eye,
  Loader2,
  RefreshCw,
  Reply,
  Send,
  XCircle,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { Separator } from "@/shared/ui/separator";
import { cn } from "@/shared/lib/cn";
import {
  useKapsoNotifications,
  useKapsoProvision,
  useSetExternalNotify,
  useToggleTemplate,
  type WaTemplateOverview,
} from "@/entities/whatsapp/api/inbox";
import { toast } from "sonner";

/**
 * Panel "Notificaciones": los templates de WhatsApp son el core del sistema.
 * Lista cada mensaje automático con su estado de aprobación en Meta, su
 * preview real (con botones) y su toggle. Al final, la notificación de
 * nuevos pedidos a un número externo.
 */
export function NotificationsPanel({
  storeId,
  connected,
}: {
  storeId: string;
  connected: boolean;
}) {
  const query = useKapsoNotifications(storeId, { poll: connected });
  const toggle = useToggleTemplate();
  const provision = useKapsoProvision();

  if (query.isLoading) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const data = query.data;
  if (!data) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No se pudo cargar la configuración de notificaciones.
      </p>
    );
  }

  const statusTemplates = data.templates.filter((t) => !t.isExternal);
  const externalTemplate = data.templates.find((t) => t.isExternal);
  const missing = data.templates.filter((t) => t.status === "NOT_CREATED");

  return (
    <div className="space-y-4">
      {!connected && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            Estas son las notificaciones automáticas disponibles. Para
            activarlas, primero conecta tu número en la pestaña{" "}
            <b>Conexión</b>. Al conectar, las plantillas se crean y se envían a
            aprobación de Meta automáticamente.
          </span>
        </div>
      )}

      {connected && missing.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-400">
          <span>
            Faltan {missing.length} plantilla(s) por crear en Meta.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => provision.mutate({ storeId })}
            disabled={provision.isPending}
          >
            {provision.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Crear plantillas
          </Button>
        </div>
      )}

      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">
          Mensajes automáticos al cliente
        </p>
        {statusTemplates.map((tpl) => (
          <TemplateCard
            key={tpl.name}
            template={tpl}
            connected={connected}
            busy={toggle.isPending && toggle.variables?.templateName === tpl.name}
            onToggle={(enabled) =>
              toggle.mutate({ storeId, templateName: tpl.name, enabled })
            }
          />
        ))}
      </div>

      {externalTemplate && (
        <>
          <Separator />
          <ExternalNotifyCard
            storeId={storeId}
            template={externalTemplate}
            connected={connected}
            initialEnabled={data.notify_external.enabled}
            initialPhone={data.notify_external.phone}
          />
        </>
      )}

      <div className="flex justify-end">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          className="text-muted-foreground"
        >
          <RefreshCw className={cn("h-4 w-4", query.isFetching && "animate-spin")} />
          Actualizar estado
        </Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ card estándar

function TemplateCard({
  template,
  connected,
  busy,
  onToggle,
}: {
  template: WaTemplateOverview;
  connected: boolean;
  busy: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{template.label}</span>
            <StatusBadge status={template.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{template.event}</p>
        </div>
        <div className="flex items-center gap-2">
          {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Switch
            checked={template.enabled}
            disabled={!connected || busy}
            onCheckedChange={onToggle}
            aria-label={`Activar ${template.label}`}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowPreview((v) => !v)}
        className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
      >
        <Eye className="h-3.5 w-3.5" />
        {showPreview ? "Ocultar mensaje" : "Ver mensaje"}
        <ChevronDown
          className={cn("h-3 w-3 transition-transform", showPreview && "rotate-180")}
        />
      </button>

      {showPreview && <WhatsAppPreview template={template} className="mt-3" />}
    </div>
  );
}

// ---------------------------------------------------- notificación externa

function ExternalNotifyCard({
  storeId,
  template,
  connected,
  initialEnabled,
  initialPhone,
}: {
  storeId: string;
  template: WaTemplateOverview;
  connected: boolean;
  initialEnabled: boolean;
  initialPhone: string;
}) {
  const setExternal = useSetExternalNotify();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [phone, setPhone] = useState(initialPhone);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    setEnabled(initialEnabled);
    setPhone(initialPhone);
  }, [initialEnabled, initialPhone]);

  const dirty = enabled !== initialEnabled || phone !== initialPhone;

  const save = async (nextEnabled: boolean) => {
    if (nextEnabled && !phone.trim()) {
      toast.error("Ingresa el número que recibirá las notificaciones");
      return;
    }
    await setExternal.mutateAsync({
      storeId,
      enabled: nextEnabled,
      phone: phone.trim(),
    });
    toast.success(
      nextEnabled
        ? "Listo: te avisaremos cada nuevo pedido a ese número"
        : "Notificación a número externo desactivada",
    );
  };

  return (
    <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{template.label}</span>
            <StatusBadge status={template.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{template.event}</p>
        </div>
        <Switch
          checked={enabled}
          disabled={!connected || setExternal.isPending}
          onCheckedChange={(next) => {
            setEnabled(next);
            // Apagar guarda directo; prender requiere número válido
            if (!next) void save(false);
            else if (phone.trim()) void save(true);
          }}
          aria-label="Activar notificación a número externo"
        />
      </div>

      <div className="mt-3 space-y-2">
        <Label htmlFor="external-phone" className="text-xs">
          Número que recibirá los avisos (con código de país, solo dígitos)
        </Label>
        <div className="flex gap-2">
          <Input
            id="external-phone"
            placeholder="59170000000"
            value={phone}
            inputMode="numeric"
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            disabled={!connected || setExternal.isPending}
            className="max-w-56 bg-background"
          />
          <Button
            size="sm"
            onClick={() => void save(enabled || true)}
            disabled={!connected || setExternal.isPending || (!dirty && enabled)}
          >
            {setExternal.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Guardar"
            )}
          </Button>
        </div>
        <ul className="space-y-1 pt-1 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <Reply className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            <b>Preparar pedido</b>: un toque y el pedido pasa a "En proceso" (el
            cliente se entera al instante).
          </li>
          <li className="flex items-center gap-1.5">
            <ExternalLink className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            <b>Ver ubicación</b>: abre Google Maps con la dirección del cliente.
          </li>
          <li className="flex items-center gap-1.5">
            <ExternalLink className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            <b>Ver pedido</b>: abre el detalle del pedido.
          </li>
        </ul>
      </div>

      <button
        type="button"
        onClick={() => setShowPreview((v) => !v)}
        className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
      >
        <Eye className="h-3.5 w-3.5" />
        {showPreview ? "Ocultar mensaje" : "Ver mensaje"}
      </button>
      {showPreview && <WhatsAppPreview template={template} className="mt-3" />}
    </div>
  );
}

// ---------------------------------------------------------------- preview

/** Burbuja estilo WhatsApp con el body de ejemplo y los botones del template */
function WhatsAppPreview({
  template,
  className,
}: {
  template: WaTemplateOverview;
  className?: string;
}) {
  const exampleMap = Object.fromEntries(
    template.params.map((p) => [p.param_name, p.example]),
  );
  const body = template.body.replace(
    /\{\{\s*(\w+)\s*\}\}/g,
    (_m, key) => exampleMap[key] ?? `{{${key}}}`,
  );

  return (
    <div
      className={cn(
        "rounded-lg bg-[#e4ddd4] p-3 dark:bg-slate-800",
        className,
      )}
    >
      <div className="max-w-[320px] overflow-hidden rounded-lg rounded-tl-sm bg-white shadow-sm dark:bg-slate-700">
        <p className="whitespace-pre-line px-3 pb-1 pt-2 text-[13px] leading-snug text-slate-800 dark:text-slate-100">
          {body}
        </p>
        <p className="px-3 pb-1.5 text-right text-[10px] text-slate-400">10:30</p>
        {template.buttons.length > 0 && (
          <div className="border-t border-slate-100 dark:border-slate-600">
            {template.buttons.map((button) => (
              <div
                key={button.text}
                className="flex items-center justify-center gap-1.5 border-b border-slate-100 py-2 text-[13px] font-medium text-sky-600 last:border-b-0 dark:border-slate-600 dark:text-sky-400"
              >
                {button.type === "URL" ? (
                  <ExternalLink className="h-3.5 w-3.5" />
                ) : (
                  <Reply className="h-3.5 w-3.5" />
                )}
                {button.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ badge

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "APPROVED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" /> Aprobada
        </span>
      );
    case "PENDING":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
          <Loader2 className="h-3 w-3 animate-spin" /> En revisión
        </span>
      );
    case "REJECTED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800 dark:bg-red-900/20 dark:text-red-400">
          <XCircle className="h-3 w-3" /> Rechazada
        </span>
      );
    case "PAUSED":
      return (
        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
          Pausada
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-800 dark:bg-gray-800 dark:text-gray-100">
          No creada
        </span>
      );
  }
}
