import { Sparkles } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/shared/ui/select";
import { cn } from "@/shared/lib/cn";
import {
  nombreProveedor,
  useModeloIa,
  type AiProviderId,
} from "@/shared/hooks/use-modelo-ia";

/**
 * Con qué IA genera el panel. Un solo select con los modelos recomendados de
 * las tres: elegir un modelo elige también el proveedor, que es como lo piensa
 * el usuario ("quiero Gemini Flash"), no en dos pasos.
 *
 * Los proveedores sin API key se muestran igual pero deshabilitados y con el
 * motivo: si se ocultaran, un dueño que espera ver GPT creería que se rompió.
 */
export function AiModelPicker({ className }: { className?: string }) {
  const { modelo, proveedores, elegir } = useModeloIa();

  if (!modelo || proveedores.length === 0) return null;

  const activo = proveedores.find((p) => p.id === modelo.provider);
  const etiqueta =
    activo?.models.find((m) => m.id === modelo.model)?.label ?? modelo.model;

  return (
    <Select
      value={`${modelo.provider}:${modelo.model}`}
      onValueChange={(siguiente) => {
        const [provider, model] = siguiente.split(":");
        elegir({ provider: provider as AiProviderId, model });
      }}
    >
      <SelectTrigger
        className={cn("h-8 w-auto max-w-[11rem] gap-1.5 px-2.5 text-xs font-medium", className)}
        aria-label="Modelo de IA para generar"
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
        <span className="truncate">{etiqueta}</span>
      </SelectTrigger>
      <SelectContent align="end" className="max-h-80">
        {proveedores.map((p) => (
          <SelectGroup key={p.id}>
            <SelectLabel className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wider">
              {nombreProveedor(p.id)}
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
                <span className="block text-[11px] text-muted-foreground">{m.hint}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
