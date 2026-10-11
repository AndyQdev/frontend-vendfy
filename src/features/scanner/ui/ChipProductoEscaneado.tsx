import type { ReactNode } from "react";
import { Package, ScanBarcode, X } from "lucide-react";

/**
 * Arriba de una lista filtrada por lo que se escaneó: qué producto es, el
 * resumen que importa en esa pantalla ("34 vendidas · Bs 408 · la última
 * hace 2 días") y el chip para volver a ver todo.
 */
export function ChipProductoEscaneado({
  nombre,
  imagen,
  resumen,
  cargando,
  onQuitar,
  quitarEtiqueta = "Ver todo de nuevo",
}: {
  nombre: string;
  imagen: string | null | undefined;
  /** Lo que se sabe de ese producto en esta pantalla. */
  resumen?: ReactNode;
  cargando?: boolean;
  onQuitar: () => void;
  /** Para el lector de pantalla: a qué se vuelve al sacarlo. */
  quitarEtiqueta?: string;
}) {
  return (
    <div
      data-testid="filtro-escaneado"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/25 bg-card p-3 shadow-card"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
        {imagen ? (
          <img src={imagen} alt="" className="h-full w-full object-cover" />
        ) : (
          <Package className="h-5 w-5 text-muted-foreground" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{nombre}</p>
        {cargando ? (
          <div className="mt-1 h-3.5 w-48 animate-pulse rounded bg-muted" />
        ) : resumen ? (
          <p className="text-[13px] text-muted-foreground">{resumen}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onQuitar}
        aria-label={quitarEtiqueta}
        className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-soft py-1 pl-2.5 pr-1.5 text-xs font-medium text-primary-soft-foreground transition-colors hover:bg-primary-soft/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ScanBarcode className="h-3.5 w-3.5" aria-hidden />
        Solo este producto
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
