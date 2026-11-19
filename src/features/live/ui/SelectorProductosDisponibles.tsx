import { useEffect, useMemo, useState } from "react";
import { PackageSearch, Radio, Search } from "lucide-react";
import { toast } from "sonner";

import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogBody as DialogBody,
} from "@/shared/ui/responsive-dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { useAddLiveItems, useProductosReutilizables } from "@/entities/live/api";

/** Lo máximo que trae el servidor por consulta. Más que esto no se elige a mano. */
const POR_PAGINA = 100;

/** Lo que se espera a que deje de tipear antes de volver a preguntar. */
const RETARDO = 300;

/**
 * Elegir qué productos entran al Live.
 *
 * Una sola lista con un interruptor, no dos listas: "lo que pasó por un Live"
 * es un **subconjunto** del catálogo, no un conjunto aparte. En cuanto una
 * prenda del catálogo entra a una sesión queda una fila en `live_item` que no
 * se borra nunca, así que desde el Live siguiente cumpliría las dos
 * condiciones y aparecería en los dos lados. El interruptor angosta; no
 * reparte.
 *
 * La búsqueda y el recorte están en el servidor. Traer el catálogo entero para
 * filtrarlo acá anda bien con treinta productos y es insostenible con mil,
 * justo cuando la pantalla se usa con la cámara prendida.
 *
 * La lista sale del INVENTARIO, no de lo anotado en los Lives viejos: si una
 * prenda "no vendida" se terminó cobrando en la caja, acá no aparece.
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
  const [soloDeLives, setSoloDeLives] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [consulta, setConsulta] = useState("");
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());

  const agregar = useAddLiveItems(liveId);

  // Se pregunta cuando deja de tipear, no en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setConsulta(busqueda), RETARDO);
    return () => clearTimeout(t);
  }, [busqueda]);

  // Al cerrar queda limpia: abrirla de nuevo no arrastra una selección vieja
  // ni una búsqueda que ya no viene al caso.
  useEffect(() => {
    if (open) return;
    setElegidos(new Set());
    setBusqueda("");
    setConsulta("");
    setSoloDeLives(true);
  }, [open]);

  const { data, isLoading, isFetching } = useProductosReutilizables(
    storeId,
    liveId,
    { q: consulta, soloDeLives, limite: POR_PAGINA },
  );

  const productos = data?.items ?? [];
  const total = data?.total ?? 0;
  const hayMas = total > productos.length;

  const idsVisibles = useMemo(
    () => productos.map((p) => p.storeProductId),
    [productos],
  );
  const marcadosVisibles = idsVisibles.filter((id) => elegidos.has(id)).length;
  const todosMarcados =
    idsVisibles.length > 0 && marcadosVisibles === idsVisibles.length;

  const alternar = (id: string) => {
    setElegidos((previo) => {
      const siguiente = new Set(previo);
      siguiente.has(id) ? siguiente.delete(id) : siguiente.add(id);
      return siguiente;
    });
  };

  /** Marca o desmarca lo que está a la vista, sin tocar lo elegido en otra búsqueda. */
  const alternarTodos = () => {
    setElegidos((previo) => {
      const siguiente = new Set(previo);
      if (todosMarcados) idsVisibles.forEach((id) => siguiente.delete(id));
      else idsVisibles.forEach((id) => siguiente.add(id));
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
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message || "No se pudieron agregar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar productos</DialogTitle>
          <DialogDescription>
            Lo que tiene stock en esta tienda y todavía no está en el Live.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre"
              className="pl-9"
            />
          </div>

          <Tabs
            value={soloDeLives ? "lives" : "todo"}
            onValueChange={(v) => setSoloDeLives(v === "lives")}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="lives">De Lives anteriores</TabsTrigger>
              <TabsTrigger value="todo">Todo el inventario</TabsTrigger>
            </TabsList>
          </Tabs>

          {productos.length > 0 && (
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-2 py-2">
              <Checkbox
                checked={todosMarcados}
                onCheckedChange={alternarTodos}
                aria-label="Seleccionar todo"
              />
              <span className="flex-1 text-sm font-medium">
                {todosMarcados ? "Quitar la selección" : "Seleccionar todo"}
              </span>
              <span className="text-xs text-muted-foreground">
                {marcadosVisibles} de {productos.length}
              </span>
            </label>
          )}

          <div className="max-h-80 space-y-1 overflow-y-auto">
            {isLoading && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Cargando...
              </p>
            )}

            {!isLoading && productos.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                <PackageSearch className="h-8 w-8" />
                <p className="text-sm">
                  {consulta
                    ? "Nada coincide con esa búsqueda."
                    : soloDeLives
                      ? "Todavía no hay prendas de Lives anteriores con stock."
                      : "No hay productos con stock en esta tienda."}
                </p>
              </div>
            )}

            {productos.map((p) => (
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
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>
                      {p.disponible} disponible{p.disponible === 1 ? "" : "s"}
                    </span>
                    {/* Solo en la lista completa: en la de Lives anteriores lo
                        cumplen todos y la marca no diría nada. */}
                    {!soloDeLives && p.deLive && (
                      <Badge variant="secondary" className="gap-1 px-1.5 py-0">
                        <Radio className="h-3 w-3" />
                        de un Live
                      </Badge>
                    )}
                  </div>
                </div>
                <span className="text-sm tabular-nums">{p.price.toFixed(2)}</span>
              </label>
            ))}
          </div>

          {/* Si el filtro da más de lo que entra en una consulta, se dice: una
              casilla de "seleccionar todo" que en realidad marca una parte es
              peor que no tenerla. */}
          {hayMas && (
            <p className="text-xs text-muted-foreground">
              Se muestran {productos.length} de {total}. Afina la búsqueda para
              ver el resto.
            </p>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            <span className="text-sm text-muted-foreground">
              {isFetching && !isLoading
                ? "Buscando..."
                : elegidos.size > 0
                  ? `${elegidos.size} seleccionada${elegidos.size === 1 ? "" : "s"}`
                  : ""}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={confirmar}
                disabled={elegidos.size === 0 || agregar.isPending}
              >
                {elegidos.size > 0
                  ? `Agregar ${elegidos.size}`
                  : "Agregar"}
              </Button>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
