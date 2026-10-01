import { useMemo, useState } from "react";
import { PackageSearch, Search } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Checkbox } from "@/shared/ui/checkbox";
import { useAddLiveItems, useProductosReutilizables } from "@/entities/live/api";

/**
 * Reutilizar lo que sobró de Lives anteriores.
 *
 * La lista sale del inventario, no de lo que quedó anotado en los Lives
 * viejos: si una prenda "no vendida" se terminó vendiendo en la caja, acá no
 * aparece. Y se limita a productos que ya pasaron por algún Live, porque esta
 * pantalla es para elegir rápido, no para navegar el catálogo entero.
 */
export function SelectorProductosDisponibles({
  open,
  onOpenChange,
  liveId,
  storeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liveId: string;
  storeId?: string;
}) {
  const { data: productos = [], isLoading } = useProductosReutilizables(storeId, liveId);
  const agregar = useAddLiveItems(liveId);

  const [busqueda, setBusqueda] = useState("");
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter((p) => p.name.toLowerCase().includes(q));
  }, [productos, busqueda]);

  const alternar = (id: string) => {
    setElegidos((prev) => {
      const siguiente = new Set(prev);
      siguiente.has(id) ? siguiente.delete(id) : siguiente.add(id);
      return siguiente;
    });
  };

  const confirmar = async () => {
    if (elegidos.size === 0) return;
    try {
      const sumados = await agregar.mutateAsync([...elegidos]);
      toast.success(
        sumados.length === 1
          ? "1 prenda agregada al Live"
          : `${sumados.length} prendas agregadas al Live`,
      );
      setElegidos(new Set());
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message || "No se pudieron agregar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Productos disponibles</DialogTitle>
          <DialogDescription>
            Lo que quedó de Lives anteriores y todavía tiene stock.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar"
            className="pl-9"
          />
        </div>

        <div className="max-h-80 space-y-1 overflow-y-auto">
          {isLoading && (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
          )}

          {!isLoading && filtrados.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <PackageSearch className="h-8 w-8" />
              <p className="text-sm">
                {productos.length === 0
                  ? "Todavía no hay prendas de Lives anteriores con stock."
                  : "Nada coincide con esa búsqueda."}
              </p>
            </div>
          )}

          {filtrados.map((p) => (
            <label
              key={p.storeProductId}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-2 py-2 hover:bg-muted"
            >
              <Checkbox
                checked={elegidos.has(p.storeProductId)}
                onCheckedChange={() => alternar(p.storeProductId)}
              />
              {p.imageUrls[0] ? (
                <img
                  src={p.imageUrls[0]}
                  alt=""
                  className="h-10 w-10 rounded object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.disponible} disponible{p.disponible === 1 ? "" : "s"}
                </p>
              </div>
              <span className="text-sm tabular-nums">{p.price.toFixed(2)}</span>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-muted-foreground">
            {elegidos.size > 0 ? `${elegidos.size} seleccionada${elegidos.size === 1 ? "" : "s"}` : ""}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmar}
              disabled={elegidos.size === 0 || agregar.isPending}
            >
              Agregar seleccionados
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
