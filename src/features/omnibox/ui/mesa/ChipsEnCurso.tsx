import type { Dispatch } from "react";
import { ChevronUp, ShoppingCart, Truck } from "lucide-react";

import { enCurso, type AccionMesa, type Mesa } from "../../model/mesa";

/**
 * "Venta en curso · 2": lo armado que no está a la vista.
 *
 * Cerrar el panel o pasar a una compra no pierde la venta; este chip es la
 * prueba visible de eso y el camino de vuelta. Va encima del campo, que es
 * donde está la mirada mientras se escribe.
 */
export function ChipsEnCurso({ mesa, despachar }: { mesa: Mesa; despachar: Dispatch<AccionMesa> }) {
  const pendientes = enCurso(mesa);
  if (pendientes.length === 0) return null;

  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {pendientes.map((p) => (
        <button
          key={p.tipo}
          type="button"
          data-testid="omnibox-chip-mesa"
          data-mesa={p.tipo}
          onClick={() => despachar({ tipo: "abrir", mesa: p.tipo })}
          className="flex items-center gap-2 rounded-full border border-primary/25 bg-primary-soft px-3.5 py-1.5 text-[13px] font-semibold text-primary shadow-card transition-colors hover:border-primary/50"
        >
          {p.tipo === "venta" ? <ShoppingCart className="size-4" /> : <Truck className="size-4" />}
          {p.tipo === "venta" ? "Venta" : "Compra"} en curso · {p.lineas}
          <ChevronUp className="size-4 opacity-70" />
        </button>
      ))}
    </div>
  );
}
