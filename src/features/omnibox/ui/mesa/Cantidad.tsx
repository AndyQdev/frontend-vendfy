import { Minus, Plus } from "lucide-react";

import { cn } from "@/shared/lib/cn";

/**
 * El − 1 + de la cantidad.
 *
 * Botones de 36 px como mínimo: se usa con el pulgar, muchas veces con la otra
 * mano ocupada. El número se puede escribir también: para 24 unidades, 23
 * toques al + es un castigo.
 */
export function Cantidad({
  valor,
  onCambio,
  minimo = 1,
  etiqueta = "Cantidad",
  compacta = false,
}: {
  valor: number;
  onCambio: (v: number) => void;
  minimo?: number;
  etiqueta?: string;
  compacta?: boolean;
}) {
  const alto = compacta ? "h-9" : "h-11";
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className={cn("inline-flex items-stretch overflow-hidden rounded-lg border border-border bg-card", alto)}
    >
      <button
        type="button"
        aria-label="Uno menos"
        onClick={() => onCambio(valor - 1)}
        disabled={valor <= minimo && minimo > 0}
        className="grid w-9 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
      >
        <Minus className="size-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={minimo}
        aria-label={etiqueta}
        value={valor}
        onChange={(e) => {
          const n = Math.floor(Number(e.target.value));
          if (Number.isFinite(n)) onCambio(n);
        }}
        className="cifra w-12 border-x border-border bg-transparent text-center text-sm font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        aria-label="Uno más"
        onClick={() => onCambio(valor + 1)}
        className="grid w-9 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
