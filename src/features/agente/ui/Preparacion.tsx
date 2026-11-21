import { CheckCircle2, CircleAlert } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { cn } from "@/shared/lib/cn";
import type { ItemPreparacion } from "@/entities/agente/model/types";

/** Qué le falta al agente para vender con anuncios, en una lista que se lee de un vistazo. */
export function Preparacion({ items, onIr }: { items: ItemPreparacion[]; onIr?: (id: string) => void }) {
  const faltan = items.filter((i) => !i.ok);
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">Preparación para vender con anuncios</h2>
          <p className="text-sm text-muted-foreground">
            {faltan.length === 0 ? "Todo listo: tu vendedor tiene lo que necesita." : `Le faltan ${faltan.length} cosa${faltan.length === 1 ? "" : "s"} antes de pautar.`}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
            faltan.length === 0
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
          )}
        >
          {items.length - faltan.length}/{items.length}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {items.map((i) => (
          <li key={i.id} className="flex items-start gap-3 py-2.5">
            {i.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Listo" />
            ) : (
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400" aria-label="Falta" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{i.titulo}</p>
              <p className="text-xs text-muted-foreground">{i.detalle}</p>
            </div>
            {!i.ok && onIr && (
              <button type="button" onClick={() => onIr(i.id)} className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline">
                Resolver
              </button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
