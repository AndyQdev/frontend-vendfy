import { useState } from "react";
import { AlertTriangle, Check, Loader2, RotateCcw, Undo2 } from "lucide-react";

import { cn } from "@/shared/lib/cn";

import { hora, type EventoVenta } from "../../model/mensaje";
import { BotonSecundario, FotoProducto, dinero } from "../piezas";

const PAGO = { efectivo: "Efectivo", qr: "QR", tarjeta: "Tarjeta" } as const;

/**
 * La venta cobrada, en el hilo del chat.
 *
 * Queda en la conversación aunque se haya cobrado tocando el panel: el hilo
 * cuenta todo lo que se hizo. Y trae "Anular venta" como red de seguridad —
 * se puede cobrar hablando (D2), así que deshacer tiene que estar a un toque.
 * Anular pide una segunda confirmación ahí mismo: un toque sin querer no
 * puede devolver una venta.
 */
export function TarjetaVenta({
  evento,
  cuando,
  anulando,
  onAnular,
}: {
  evento: EventoVenta;
  cuando: Date;
  anulando: boolean;
  onAnular: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const { venta, lineas, anulada } = evento;
  const aPedido = venta.estado === "por-confirmar";

  return (
    <article
      data-testid="omnibox-venta"
      data-estado={anulada ? "anulada" : "cobrada"}
      className={cn(
        "w-full space-y-3 rounded-xl border border-border bg-card p-4 shadow-card",
        anulada && "opacity-70",
      )}
    >
      <header className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full",
            anulada ? "bg-muted text-muted-foreground" : "bg-success text-success-foreground",
          )}
        >
          {anulada ? <Undo2 className="size-4" /> : <Check className="size-5" strokeWidth={3} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            Venta <span className="cifra">#{venta.numero}</span> {anulada ? "anulada" : "cobrada"}
          </p>
          <p className="text-[13px] text-muted-foreground">
            {venta.cliente} · {PAGO[venta.pago]}
            {anulada && " · el stock volvió"}
          </p>
        </div>
        <div className="text-right">
          <p className={cn("cifra text-xl font-bold", anulada && "line-through")}>Bs {dinero(venta.total)}</p>
          <p className="cifra text-[11px] text-muted-foreground">{hora(cuando)}</p>
        </div>
      </header>

      <ul className="flex flex-wrap gap-2">
        {lineas.map((l) => (
          <li key={l.nombre} className="flex items-center gap-2 rounded-lg border border-border py-1 pl-1 pr-2.5 text-[13px]">
            <FotoProducto src={l.imagen} className="size-7" />
            <span className="cifra font-semibold">{l.cantidad} ×</span>
            <span className="max-w-[12rem] truncate">{l.nombre}</span>
          </li>
        ))}
      </ul>

      {aPedido && !anulada && (
        <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-[13px] font-medium text-warning-soft-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Algo era a pedido y faltaba: la venta quedó por confirmar y todavía no descontó stock.
        </p>
      )}

      {!anulada &&
        (confirmando ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 p-2">
            <p className="flex-1 px-1 text-[13px]">¿Anular la venta? El stock vuelve a la tienda.</p>
            <BotonSecundario onClick={() => setConfirmando(false)} disabled={anulando} className="h-9">
              No
            </BotonSecundario>
            <button
              type="button"
              data-testid="omnibox-confirmar-anular"
              onClick={onAnular}
              disabled={anulando}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-destructive px-3 text-[13px] font-semibold text-destructive-foreground disabled:opacity-60"
            >
              {anulando && <Loader2 className="size-4 animate-spin" />}
              Sí, anular
            </button>
          </div>
        ) : (
          <button
            type="button"
            data-testid="omnibox-anular"
            onClick={() => setConfirmando(true)}
            className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-destructive"
          >
            <RotateCcw className="size-3.5" />
            Anular venta
          </button>
        ))}
    </article>
  );
}
