import { createContext, useContext } from "react";
import { Filter, Package, Store, Tag, User } from "lucide-react";

import type { Condicion, Filtros, TipoFiltro } from "@/entities/omnibox/model/types";
import { cn } from "@/shared/lib/cn";

import { filtrosDe, textoCondicion } from "../../model/vistas";

const ICONO: Record<TipoFiltro, typeof User> = { cliente: User, producto: Package, categoria: Tag };

/**
 * De quién son los números (G6b): "Cliente: José Luis Mamani", o "Toda la
 * tienda" si no hay filtro. Siempre a la vista: que nunca haya que adivinar
 * si lo que se ve es de José o de todos.
 */
export function ChipsAlcance({ filtros, condiciones = [], className }: { filtros?: Filtros; condiciones?: Condicion[]; className?: string }) {
  const lista = filtrosDe(filtros);
  return (
    <div data-testid="vista-alcance" data-filtrada={lista.length > 0 || condiciones.length > 0} className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {lista.length === 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          <Store className="size-3" />
          Toda la tienda
        </span>
      ) : (
        lista.map((f) => {
          const Icono = ICONO[f.tipo];
          return (
            <span
              key={f.tipo}
              data-filtro={f.tipo}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/30 bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary"
            >
              <Icono className="size-3 shrink-0" />
              <span className="truncate">
                {f.etiqueta}: {f.nombre}
              </span>
            </span>
          );
        })
      )}
      {condiciones.map((c) => (
        <span
          key={`${c.campo}${c.op}${c.valor}`}
          data-condicion={c.campo}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/30 bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary"
        >
          <Filter className="size-3 shrink-0" />
          <span className="truncate">{textoCondicion(c)}</span>
        </span>
      ))}
    </div>
  );
}

/** El alcance de la vista, para que cada pieza lo diga en su subtítulo ("· Cliente: José"). */
export const AlcanceContext = createContext<string>("");
export const useAlcance = () => useContext(AlcanceContext);
