import { Sparkles } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/shared/ui/select";
import {
  useAgentConfig,
  useUpdateAgentConfig,
  type AgentProviderId,
} from "@/entities/whatsapp/api/agent";

const PROVIDER_NAMES: Record<AgentProviderId, string> = {
  gemini: "Gemini (Google)",
  claude: "Claude (Anthropic)",
  openai: "GPT (OpenAI)",
};

/**
 * Cambia el cerebro del agente sin salir del chat: un único select con los
 * modelos recomendados de las tres IAs. Elegir un modelo también cambia el
 * proveedor, así que el dueño puede comparar en caliente mientras prueba.
 */
export function ModelPicker({ storeId }: { storeId: string }) {
  const { data } = useAgentConfig(storeId);
  const update = useUpdateAgentConfig();

  if (!data) return null;

  const active = data.providers.find((p) => p.id === data.provider);
  const currentModel = data.model ?? active?.defaultModel ?? "";
  const value = `${data.provider}:${currentModel}`;
  // El trigger muestra solo el nombre corto: si dejáramos que Radix copie el
  // contenido del item, arrastraría también la descripción y crecería.
  const currentLabel =
    active?.models.find((m) => m.id === currentModel)?.label ?? currentModel;

  return (
    <Select
      value={value}
      disabled={update.isPending}
      onValueChange={(next) => {
        const [provider, model] = next.split(":");
        update.mutate({ storeId, provider: provider as AgentProviderId, model });
      }}
    >
      <SelectTrigger
        className="h-8 w-auto max-w-[11rem] gap-1.5 border-border/70 px-2.5 text-xs font-medium"
        aria-label="Modelo del agente"
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary-soft-foreground" />
        <span className="truncate">{currentLabel}</span>
      </SelectTrigger>
      <SelectContent align="end" className="max-h-80">
        {data.providers.map((p) => (
          <SelectGroup key={p.id}>
            <SelectLabel className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wider">
              {PROVIDER_NAMES[p.id]}
              {!p.available && (
                <span className="font-normal normal-case tracking-normal text-amber-600 dark:text-amber-400">
                  falta la clave
                </span>
              )}
            </SelectLabel>
            {p.models.map((m) => (
              <SelectItem
                key={m.id}
                value={`${p.id}:${m.id}`}
                disabled={!p.available}
                className="text-xs"
              >
                <span className="font-medium">{m.label}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {m.hint}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
