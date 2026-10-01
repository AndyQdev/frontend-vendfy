import { AlertTriangle, Banknote, CircleAlert, CreditCard, Crosshair, QrCode, X } from "lucide-react";

import { cn } from "@/shared/lib/cn";

import type { AccionGuia, MensajeGuia } from "../../model/guia";

const ICONO_PAGO = { efectivo: Banknote, qr: QrCode, tarjeta: CreditCard } as const;

/**
 * La Guía hablando: una franja sobre el campo del chat, con UN mensaje y los
 * botones que lo resuelven. Va abajo, junto al pulgar y a lo último que se
 * escribió, porque ahí está la atención; el panel puede estar cerrado (en el
 * teléfono casi siempre lo está).
 */
export function FranjaGuia({
  mensaje,
  onAccion,
  onCerrar,
}: {
  mensaje: MensajeGuia;
  onAccion: (a: AccionGuia) => void;
  onCerrar: () => void;
}) {
  const esError = mensaje.nivel === "error";
  const Icono = esError ? CircleAlert : AlertTriangle;

  return (
    <div
      data-testid="omnibox-guia"
      data-codigo={mensaje.codigo}
      data-nivel={mensaje.nivel}
      role={esError ? "alert" : "status"}
      className={cn(
        "animate-in fade-in slide-in-from-bottom-1 mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2.5 duration-200",
        esError
          ? "border-destructive/30 bg-destructive/[0.07]"
          : "border-warning/40 bg-warning-soft",
      )}
    >
      <Icono
        className={cn("size-4 shrink-0", esError ? "text-destructive" : "text-warning-soft-foreground")}
        aria-hidden
      />
      <p
        className={cn(
          "min-w-0 flex-1 text-[13px] font-medium leading-snug",
          esError ? "text-destructive" : "text-warning-soft-foreground",
        )}
      >
        {mensaje.texto}
      </p>

      {mensaje.acciones.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mensaje.acciones.map((a, i) => {
            const IconoAccion = a.tipo === "pago" ? ICONO_PAGO[a.pago] : Crosshair;
            return (
              <button
                key={i}
                type="button"
                data-testid="omnibox-guia-accion"
                onClick={() => onAccion(a)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-[13px] font-semibold text-foreground transition-colors",
                  "hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <IconoAccion className="size-3.5" />
                {a.etiqueta}
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar el aviso"
        className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
