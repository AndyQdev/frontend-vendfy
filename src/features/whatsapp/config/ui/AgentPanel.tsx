import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Bot,
  Image as ImageIcon,
  Loader2,
  MousePointerClick,
  Search,
  ShoppingCart,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import { Separator } from "@/shared/ui/separator";
import { ModelPicker } from "../../chat/ui/ModelPicker";
import {
  useAgentConfig,
  useAgentUsage,
  useUpdateAgentConfig,
  type AgentProviderId,
} from "@/entities/whatsapp/api/agent";

const PROVIDER_LABELS: Record<AgentProviderId, { name: string }> = {
  gemini: { name: "Gemini" },
  claude: { name: "Claude" },
  openai: { name: "GPT" },
};

const CAPABILITIES = [
  { icon: Search, text: "Busca en tu catálogo y responde precios y stock reales" },
  { icon: MousePointerClick, text: "Manda listas y botones para comprar con un toque" },
  { icon: ShoppingCart, text: "Arma el carrito y registra el pedido en tu sistema" },
  { icon: ImageIcon, text: "Envía fotos de productos y entiende las que le mandan" },
  { icon: UserRoundCheck, text: "Te pasa la conversación si el cliente pide un humano" },
];

/**
 * Configuración del agente IA de ventas: encendido, proveedor/modelo y la
 * personalidad que el dueño quiera darle. Sin tocar código.
 */
export function AgentPanel({ storeId }: { storeId: string }) {
  const query = useAgentConfig(storeId);
  const usage = useAgentUsage(storeId).data;
  const update = useUpdateAgentConfig();

  const [instructions, setInstructions] = useState("");

  useEffect(() => {
    if (query.data) setInstructions(query.data.instructions ?? "");
  }, [query.data]);

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
        No se pudo cargar la configuración del agente.
      </p>
    );
  }

  const dirty = instructions !== (data.instructions ?? "");
  const unavailable = data.providers.filter((p) => !p.available);

  const save = async () => {
    await update.mutateAsync({ storeId, instructions });
    toast.success("Configuración del agente guardada");
  };

  return (
    <div className="space-y-5">
      {/* Encendido */}
      <div className="flex items-start justify-between gap-3 rounded-lg border p-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Bot className="h-4 w-4 text-primary-soft-foreground" />
            Agente de ventas automático
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Responde solo los mensajes de tus clientes en WhatsApp. Si lo apagas,
            los chats siguen llegando pero nadie responde automáticamente.
          </p>
        </div>
        <Switch
          checked={data.enabled}
          disabled={update.isPending}
          onCheckedChange={(enabled) =>
            update.mutate({ storeId, enabled })
          }
          aria-label="Activar agente"
        />
      </div>

      {/* Qué sabe hacer */}
      <div className="rounded-lg bg-muted/40 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Qué hace por ti
        </p>
        <ul className="space-y-1.5">
          {CAPABILITIES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-2 text-xs">
              <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary-soft-foreground" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <Separator />

      {/* Motor (proveedor + modelo, en un solo select) */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Motor de inteligencia</p>
          <ModelPicker storeId={storeId} />
        </div>
        <p className="text-xs text-muted-foreground">
          El agente hace exactamente lo mismo con cualquiera: cambia qué tan
          rápido, barato y fino responde. Puedes cambiarlo cuando quieras —
          también desde el chat de prueba, para comparar en caliente.
        </p>
        {unavailable.length > 0 && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            Sin clave configurada: {unavailable.map((p) => PROVIDER_LABELS[p.id].name).join(", ")}.
            Sus modelos salen deshabilitados en la lista.
          </p>
        )}
      </div>

      {/* Personalidad */}
      <div className="space-y-1.5">
        <Label htmlFor="agent-instructions" className="text-sm">
          Instrucciones para tu agente
        </Label>
        <Textarea
          id="agent-instructions"
          rows={5}
          maxLength={2000}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={
            "Ejemplos:\n• Trata a los clientes de “usted”.\n• Los pedidos se entregan de 9:00 a 18:00.\n• Si preguntan por delivery a otra ciudad, di que solo entregamos en la ciudad."
          }
        />
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            Se suman a lo que ya sabe hacer. Aquí van tus reglas del negocio.
          </p>
          <span className="text-[11px] text-muted-foreground">
            {instructions.length}/2000
          </span>
        </div>
      </div>

      {/* Consumo */}
      {usage && usage.turnos > 0 && (
        <>
          <Separator />
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Consumo hasta hoy
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <UsageStat label="Clientes atendidos" value={usage.conversaciones} />
              <UsageStat label="Respuestas" value={usage.turnos} />
              <UsageStat label="Pedidos cerrados" value={usage.pedidos} />
              <UsageStat
                label="Tokens"
                value={formatTokens(usage.inputTokens + usage.outputTokens)}
              />
            </div>
            {usage.pruebaTurnos > 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                No se cuentan las {usage.pruebaTurnos} respuestas del chat de
                prueba.
              </p>
            )}
          </div>
        </>
      )}

      <div className="flex items-center justify-end gap-2">
        {dirty && (
          <span className="text-xs text-muted-foreground">Cambios sin guardar</span>
        )}
        <Button onClick={save} disabled={!dirty || update.isPending}>
          {update.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Guardar
        </Button>
      </div>
    </div>
  );
}

function UsageStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border p-2.5">
      <p className="text-lg font-bold leading-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function formatTokens(total: number) {
  if (total < 1000) return String(total);
  if (total < 1_000_000) return `${(total / 1000).toFixed(1)}k`;
  return `${(total / 1_000_000).toFixed(1)}M`;
}
