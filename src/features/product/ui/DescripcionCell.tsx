import { FileText } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Textarea } from "@/shared/ui/textarea";

/**
 * La descripción que generó la IA, en la vista previa de "Crear con IA".
 *
 * En la tabla no hay lugar para un párrafo: se muestra un ícono (resaltado si
 * hay descripción) y al tocarlo se abre para leerla o corregirla.
 */
export function DescripcionCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const hay = Boolean(value?.trim());
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={hay ? "Ver descripción" : "Agregar descripción"}
          title={hay ? "Ver descripción" : "Sin descripción"}
          className={cn(
            "grid size-8 place-items-center rounded-md border transition-colors",
            hay
              ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
              : "border-dashed border-border text-muted-foreground hover:bg-muted",
          )}
        >
          <FileText className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Descripción</p>
        <Textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          placeholder="Descripción del producto"
          className="text-sm"
        />
      </PopoverContent>
    </Popover>
  );
}
