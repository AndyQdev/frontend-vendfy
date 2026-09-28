import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Package, PackagePlus, Search } from "lucide-react";

import { apiFetch } from "@/shared/api/client";
import type { ProductoOpcion } from "@/entities/omnibox/model/types";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

/**
 * Elegir un producto del catálogo.
 *
 * **Un producto no se puede completar escribiendo su nombre.** La ejecución
 * necesita el id: un texto suelto llega al backend como "una coca cola de 2
 * litros" sin `productId` y falla con "ese producto no está en tu tienda",
 * después de que la persona ya lo escribió. Por eso acá se busca y se ELIGE.
 *
 * Y si no está, se dice que no está y se ofrece crearlo, en vez de volver a
 * preguntar lo mismo.
 */
export function ElegirProducto({
  storeId,
  textoInicial,
  onElegir,
}: {
  storeId: string;
  /** Lo que se buscó y no apareció. Arranca la búsqueda ahí. */
  textoInicial?: string;
  onElegir: (producto: ProductoOpcion) => void;
}) {
  const [texto, setTexto] = useState(textoInicial ?? "");
  const [consulta, setConsulta] = useState(textoInicial ?? "");

  // Espera a que deje de escribir: una consulta por tecla castiga a la base y
  // hace parpadear la lista.
  useEffect(() => {
    const id = setTimeout(() => setConsulta(texto.trim()), 300);
    return () => clearTimeout(id);
  }, [texto]);

  const { data, isFetching } = useQuery({
    queryKey: ["omnibox", "productos", storeId, consulta],
    queryFn: async () =>
      (
        await apiFetch<ProductoOpcion[]>(
          `/api/omnibox/productos?storeId=${storeId}&q=${encodeURIComponent(consulta)}`,
        )
      ).data,
    enabled: consulta.length >= 2,
  });

  const resultados = data ?? [];
  const sinResultados = consulta.length >= 2 && !isFetching && resultados.length === 0;

  return (
    <div className="w-full space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscá el producto en tu catálogo…"
          aria-label="Buscar el producto"
          className="glass-field rounded-2xl pl-9"
        />
      </div>

      {resultados.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {resultados.map((p) => (
            <button
              key={p.storeProductId}
              type="button"
              data-testid="omnibox-opcion"
              onClick={() => onElegir(p)}
              className="glass-field press-lift flex items-center gap-3 rounded-2xl p-3 text-left"
            >
              {p.imagen ? (
                <img src={p.imagen} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="glass-track flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                  <Package className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{p.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {p.stock} en stock · Bs {p.precio}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {sinResultados && (
        <div
          data-testid="omnibox-sin-producto"
          className="glass-track flex flex-wrap items-center gap-3 rounded-2xl p-3"
        >
          <div className="min-w-[180px] flex-1">
            <p className="text-sm font-medium">
              No tenés “{consulta}” en tu catálogo
            </p>
            <p className="text-xs text-muted-foreground">
              Probá con otro nombre, o dalo de alta y volvé.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild className="gap-2">
            {/* El nombre viaja en la dirección: que lo escriba de nuevo en el
                formulario sería hacerle repetir lo que ya dijo dos veces. */}
            <Link to={`/products/create?nombre=${encodeURIComponent(consulta)}`}>
              <PackagePlus className="h-4 w-4" />
              Crear “{consulta}”
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
