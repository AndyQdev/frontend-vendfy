import {
  AlertTriangle,
  Banknote,
  CircleAlert,
  CreditCard,
  Crosshair,
  Eye,
  Lightbulb,
  Plus,
  QrCode,
  Tag,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/shared/lib/cn";

import type { AccionGuia, MensajeGuia } from "../../model/guia";

const ICONO_PAGO = { efectivo: Banknote, qr: QrCode, tarjeta: CreditCard } as const;

function iconoDe(a: AccionGuia): LucideIcon | null {
  switch (a.tipo) {
    case "pago":
      return ICONO_PAGO[a.pago];
    case "ver":
      return Crosshair;
    case "agregar":
      return Plus;
    case "comprar":
    case "proveedor":
      return Truck;
    case "precio":
      return Tag;
    case "verProducto":
      return Eye;
    default:
      return null; // cantidad (el número ya lo dice) y descartar
  }
}

const ESTILO = {
  error: {
    caja: "border-destructive/30 bg-destructive/[0.07]",
    texto: "text-destructive",
    icono: CircleAlert,
  },
  advertencia: {
    caja: "border-warning/40 bg-warning-soft",
    texto: "text-warning-soft-foreground",
    icono: AlertTriangle,
  },
  sugerencia: {
    caja: "border-primary/25 bg-primary-soft",
    texto: "text-foreground",
    icono: Lightbulb,
  },
} as const;

/**
 * La Guía hablando: una franja sobre el campo del chat, con UN mensaje y los
 * botones que lo resuelven. Va abajo, junto al pulgar y a lo último que se
 * escribió, porque ahí está la atención; el panel puede estar cerrado (en el
 * teléfono casi siempre lo está).
 *
 * Errores en rojo y advertencias en ámbar (catálogo fijo); sugerencias con el
 * color de la marca y una lamparita: proponen, no alarman.
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
  const estilo = ESTILO[mensaje.nivel];
  const Icono = estilo.icono;

  return (
    <div
      data-testid="omnibox-guia"
      data-codigo={mensaje.codigo}
      data-nivel={mensaje.nivel}
      role={mensaje.nivel === "error" ? "alert" : "status"}
      className={cn(
        "animate-in fade-in slide-in-from-bottom-1 mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2.5 duration-200",
        estilo.caja,
      )}
    >
      <Icono
        className={cn("size-4 shrink-0", mensaje.nivel === "sugerencia" ? "text-primary" : estilo.texto)}
        aria-hidden
      />
      <p className={cn("min-w-0 flex-1 text-[13px] font-medium leading-snug", estilo.texto)}>{mensaje.texto}</p>

      {mensaje.acciones.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mensaje.acciones.map((a, i) => {
            if (a.tipo === "descartar") {
              return (
                <button
                  key={i}
                  type="button"
                  data-testid="omnibox-guia-descartar"
                  onClick={() => onAccion(a)}
                  className="inline-flex h-8 items-center rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {a.etiqueta}
                </button>
              );
            }
            const IconoAccion = iconoDe(a);
            return (
              <button
                key={i}
                type="button"
                data-testid="omnibox-guia-accion"
                onClick={() => onAccion(a)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-[13px] font-semibold text-foreground transition-colors",
                  "hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  a.tipo === "cantidad" && "cifra min-w-9 justify-center",
                )}
              >
                {IconoAccion && <IconoAccion className="size-3.5" />}
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
