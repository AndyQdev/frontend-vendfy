import { useState } from "react";
import { History, Package, ScanBarcode, X } from "lucide-react";

import { useMovements } from "@/entities/inventory/api";
import { formatearCantidad } from "@/entities/inventory/model/envases";
import { esSalida, MOVEMENT_TYPE_CONFIG } from "@/entities/inventory/model/movimientos";
import type { Inventory } from "@/entities/inventory/model/types";
import { cn } from "@/shared/lib/cn";
import { PaginationControls } from "@/shared/ui/pagination";

/**
 * Todo lo que pasó con UN producto: lo que se escaneó en Movimientos.
 *
 * Compras, ventas, ajustes y mermas en una sola lista, del más nuevo al más
 * viejo: la pregunta al escanear es "¿qué pasó con esto?", no "¿cuánto se
 * vendió en total?". El chip de arriba lo saca y vuelve la vista de siempre.
 */
export function MovimientosDeProducto({
  inventarios,
  onQuitar,
}: {
  /** Una fila por tienda (con "Todas", puede haber varias). */
  inventarios: Inventory[];
  onQuitar: () => void;
}) {
  const [elegido, setElegido] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [tam, setTam] = useState(10);
  const inventario = inventarios[Math.min(elegido, inventarios.length - 1)];
  const unidad = inventario.product?.baseUnit;

  const { data, isLoading } = useMovements({
    inventoryId: inventario.id,
    limit: tam,
    offset: (pagina - 1) * tam,
    order: "DESC",
  });
  const movimientos = data?.data ?? [];
  const total = data?.countData ?? 0;
  const foto = inventario.product.imageUrls?.[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {foto ? (
            <img src={foto} alt="" className="h-full w-full object-cover" />
          ) : (
            <Package className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{inventario.product.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatearCantidad(inventario.stockQuantity, unidad)} en stock · {inventario.store.name}
          </p>
        </div>
        <button
          type="button"
          onClick={onQuitar}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-soft py-1 pl-2.5 pr-1.5 text-xs font-medium text-primary-soft-foreground transition-colors hover:bg-primary-soft/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Ver los movimientos de todos los productos"
        >
          <ScanBarcode className="h-3.5 w-3.5" aria-hidden />
          Solo este producto
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {inventarios.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Tienda:</span>
          {inventarios.map((inv, i) => (
            <button
              key={inv.id}
              type="button"
              onClick={() => {
                setElegido(i);
                setPagina(1);
              }}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                inv.id === inventario.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {inv.store.name}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : movimientos.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 text-center">
          <History className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">Este producto todavía no tiene movimientos.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <ul className="divide-y">
            {movimientos.map((m) => {
              const config = MOVEMENT_TYPE_CONFIG[m.type];
              const salida = esSalida(m.type, m.direction);
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                        config?.chip ?? "bg-muted text-muted-foreground",
                      )}
                    >
                      {config?.icon}
                      {config?.label ?? m.type}
                    </span>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          m.direction === 0
                            ? "text-foreground"
                            : salida
                              ? "text-orange-600 dark:text-orange-400"
                              : "text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {m.direction === 0 ? "" : salida ? "−" : "+"}
                        {formatearCantidad(m.quantity, unidad)}
                      </p>
                      {m.notes && <p className="truncate text-xs text-muted-foreground">{m.notes}</p>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {m.totalCost ? (
                      <p className="text-sm font-medium tabular-nums">Bs. {Number(m.totalCost).toFixed(2)}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {new Date(m.created_at).toLocaleDateString("es-BO", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="border-t p-4">
            <PaginationControls
              currentPage={pagina}
              totalPages={Math.ceil(total / tam)}
              pageSize={tam}
              totalItems={total}
              onPageChange={setPagina}
              onPageSizeChange={(t) => {
                setTam(t);
                setPagina(1);
              }}
              pageSizeOptions={[10, 20, 50]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
