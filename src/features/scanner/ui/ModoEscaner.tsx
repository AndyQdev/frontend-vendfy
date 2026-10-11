import { ScanBarcode } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { useEscaner } from "../model/ScannerProvider";
import { AjustesVoz } from "./AjustesVoz";

/** Lo que hace la pistola donde ninguna pantalla se quedó con la lectura. */
const POR_DEFECTO = "Muestra el producto y dice su precio";

/**
 * Qué hace la pistola en ESTA pantalla, a un toque, en el encabezado.
 *
 * Cada módulo hace algo distinto con un código (en Caja va al carrito, en
 * Inventario abre el stock, en Ventas…): sin esto habría que adivinarlo. Solo
 * aparece después de la primera lectura en el navegador: a quien no tiene
 * pistola no le dice nada.
 */
export function ModoEscaner({ className }: { className?: string }) {
  const { etiqueta, usado } = useEscaner();
  if (!usado) return null;
  const que = etiqueta ?? POR_DEFECTO;

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Escáner: ${que}`}
        title={`Escáner: ${que}`}
        className={cn(
          "relative grid size-10 flex-none place-items-center rounded-full text-foreground transition-colors lg:size-9 lg:bg-muted",
          "hover:bg-muted lg:hover:bg-tinta lg:hover:text-tinta-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "data-[state=open]:bg-tinta data-[state=open]:text-tinta-foreground",
          className,
        )}
      >
        <ScanBarcode className="size-[18px] lg:size-4" />
        {/* El punto dice que esta pantalla hace algo propio con el código. */}
        {etiqueta ? (
          <span className="absolute right-2 top-2 size-2 rounded-full border-[1.5px] border-card bg-acento lg:right-1.5 lg:top-1.5" />
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="w-72 max-w-[calc(100vw-1.5rem)] p-0">
        <div className="flex items-start justify-between gap-2 p-3.5 pb-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Escáner</p>
          <AjustesVoz className="-mr-1 -mt-1.5" />
        </div>
        <div className="px-3.5 pb-3.5">
          <p className="text-[13px] text-muted-foreground">En esta pantalla, al escanear:</p>
          <p className="mt-1 flex items-start gap-2 text-sm font-semibold">
            <ScanBarcode className="mt-0.5 size-4 shrink-0 text-acento" aria-hidden />
            {que}
          </p>
          <p className="mt-2.5 text-xs text-muted-foreground">
            Si el código no está registrado, te ayuda a darlo de alta con lo que sabe el catálogo.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
