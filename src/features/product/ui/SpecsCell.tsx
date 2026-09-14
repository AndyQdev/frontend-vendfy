import { useState } from "react";
import { ListTree, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

/**
 * Las especificaciones de un producto dentro de la tabla de revisión de la IA.
 *
 * La IA ya las venía generando y ya se guardaban al crear, pero la tabla no
 * las mostraba: quien pedía "ponme todo lo que encuentres en especificaciones"
 * veía el mismo resultado que si no hubiera pedido nada y daba por hecho que
 * no funcionaba.
 *
 * Van en un popover y no en la celda porque son 4-8 pares por producto: en una
 * fila de tabla no entran, y esta pantalla existe para revisar 25 productos de
 * un vistazo. La celda dice cuántas hay; el detalle se abre solo si interesa.
 */
export function SpecsCell({
  value,
  onChange,
}: {
  value?: Record<string, string>;
  onChange: (specs: Record<string, string>) => void;
}) {
  /**
   * La lista de pares vive acá y no se deriva del objeto en cada render, por
   * dos razones que solo aparecen al escribir:
   *
   * - Una fila recién agregada está vacía, y un objeto no puede tener una
   *   clave vacía: se borraría antes de que se pueda escribir en ella.
   * - Renombrar una clave sobre el objeto es borrar y volver a crear, así que
   *   la fila salta al final del listado en mitad de la palabra.
   */
  const [pares, setPares] = useState<[string, string][]>(() =>
    Object.entries(value ?? {}),
  );

  // Hacia arriba viaja el objeto, ya sin las filas a medio escribir.
  const guardar = (siguiente: [string, string][]) => {
    setPares(siguiente);
    onChange(Object.fromEntries(siguiente.filter(([k]) => k.trim())));
  };

  const editar = (i: number, parte: 0 | 1, texto: string) => {
    const copia = pares.map((p) => [...p] as [string, string]);
    copia[i][parte] = texto;
    guardar(copia);
  };

  const cuantas = pares.filter(([k]) => k.trim()).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-accent"
          aria-label={
            cuantas === 0
              ? "Agregar especificaciones"
              : `Ver las ${cuantas} especificaciones`
          }
        >
          {cuantas === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <>
              <ListTree className="h-3.5 w-3.5 text-muted-foreground" />
              <Badge variant="outline" className="py-0 text-xs">
                {cuantas}
              </Badge>
            </>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Especificaciones
        </p>

        {pares.length === 0 && (
          <p className="mb-2 text-xs text-muted-foreground">
            La IA no encontró ninguna para este producto.
          </p>
        )}

        <div className="max-h-64 space-y-1.5 overflow-y-auto">
          {pares.map(([clave, valor], i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input
                value={clave}
                onChange={(e) => editar(i, 0, e.target.value)}
                placeholder="Clave"
                className="h-7 w-[38%] text-xs"
              />
              <Input
                value={valor}
                onChange={(e) => editar(i, 1, e.target.value)}
                placeholder="Valor"
                className="h-7 flex-1 text-xs"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                aria-label={`Quitar ${clave || "la fila vacía"}`}
                onClick={() => guardar(pares.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="mt-2 h-7 w-full text-xs"
          onClick={() => guardar([...pares, ["", ""]])}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Agregar
        </Button>
      </PopoverContent>
    </Popover>
  );
}
