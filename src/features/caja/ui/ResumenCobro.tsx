import type { ElementType } from "react";
import { cn } from "@/shared/lib/cn";
import { formatMoney } from "@/shared/lib/money";
import { Button } from "@/shared/ui/button";
import type { useDolarElegido } from "@/entities/exchange-rate/ui/dolar";
import { FilasDolares } from "./CobroEnDolares";

export interface MetodoPago {
  id: string;
  name: string;
  icon: ElementType;
}

/**
 * El pie del carrito: cómo paga, cuánto es y el botón. Va pegado abajo y no
 * crece: lo que se agrega al carrito se desplaza arriba, el botón de
 * finalizar queda siempre a la vista.
 *
 * Todo lo que es plata está en una sola tarjeta, en el orden en que se lee:
 * subtotal y descuento, el cobro en dólares si corresponde, y el total.
 */
export function ResumenCobro({
  subtotal,
  descuento = 0,
  total,
  metodos,
  metodo,
  onMetodo,
  dolar,
  usdRecibido,
  onUsdRecibido,
  onFinalizar,
  deshabilitado,
  className,
}: {
  subtotal: number;
  descuento?: number;
  total: number;
  metodos: MetodoPago[];
  metodo: string;
  onMetodo: (id: string) => void;
  dolar: ReturnType<typeof useDolarElegido>;
  usdRecibido: string;
  onUsdRecibido: (v: string) => void;
  onFinalizar: () => void;
  deshabilitado: boolean;
  className?: string;
}) {
  const enDolares = metodo === "usd";
  return (
    <div className={cn("space-y-2.5", className)} data-testid="resumen-cobro">
      <div
        role="radiogroup"
        aria-label="Método de pago"
        className={cn("grid gap-1.5", metodos.length === 4 ? "grid-cols-4" : "grid-cols-3")}
      >
        {metodos.map((m) => {
          const Icon = m.icon;
          const activo = metodo === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => onMetodo(m.id)}
              className={cn(
                "flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg border px-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                activo
                  ? "border-primary/40 bg-primary-soft text-primary-soft-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/30",
              )}
            >
              <Icon className={cn("h-3.5 w-3.5 shrink-0", activo ? "text-primary" : "text-muted-foreground")} aria-hidden />
              <span className="truncate">{m.name}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3 dark:bg-muted/20">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            Subtotal <span className="cifra text-foreground">{formatMoney(subtotal)}</span>
          </span>
          <span>
            Descuento <span className="cifra">{formatMoney(descuento)}</span>
          </span>
        </div>
        {enDolares && (
          <FilasDolares total={total} dolar={dolar} usd={usdRecibido} onUsd={onUsdRecibido} />
        )}
        <div className="flex items-baseline justify-between border-t border-border pt-2">
          <span className="text-sm font-bold">Total</span>
          <span className="cifra font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="total-venta">
            {formatMoney(total)}
          </span>
        </div>
      </div>

      <Button
        className="h-11 w-full border-0 text-sm font-bold text-white shadow-[var(--cta-shadow)] transition-all hover:-translate-y-px hover:brightness-105 disabled:opacity-60"
        style={{ background: "var(--primary-grad)" }}
        size="lg"
        onClick={onFinalizar}
        disabled={deshabilitado}
      >
        Finalizar Venta
      </Button>
    </div>
  );
}
