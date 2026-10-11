import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Package, PackagePlus, Search } from "lucide-react";

import { apiFetch } from "@/shared/api/client";
import type { ProductoOpcion } from "@/entities/omnibox/model/types";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

import { useCrearEnChat } from "./formularios/crear-en-chat";

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
  autoFoco = true,
  onElegir,
}: {
  storeId: string;
  /** Lo que se buscó y no apareció. Arranca la búsqueda ahí. */
  textoInicial?: string;
  /**
   * Dentro de un pedido NO: la tarjeta llega mientras la persona sigue
   * escribiendo en el chat, y el foco saltaría a este buscador.
   */
  autoFoco?: boolean;
  onElegir: (producto: ProductoOpcion) => void;
}) {
  const [texto, setTexto] = useState(textoInicial ?? "");
  const [consulta, setConsulta] = useState(textoInicial ?? "");
  const crearEnChat = useCrearEnChat();

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
          autoFocus={autoFoco}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscá el producto en tu catálogo…"
          aria-label="Buscar el producto"
          className="pl-9"
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
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5 text-left transition-colors hover:border-border-strong hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
            >
              {p.imagen ? (
                <img src={p.imagen} alt="" className="h-10 w-10 shrink-0 rounded-md border border-border object-cover" />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Package className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold">{p.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="cifra">{p.stock} un</span> en stock · <span className="cifra">Bs {p.precio}</span>
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {sinResultados && (
        <div
          data-testid="omnibox-sin-producto"
          className="flex flex-wrap items-center gap-3 rounded-lg bg-muted p-3"
        >
          <div className="min-w-[180px] flex-1">
            <p className="text-[13px] font-semibold">
              No tenés “{consulta}” en tu catálogo
            </p>
            <p className="text-xs text-muted-foreground">
              Probá con otro nombre, o crealo acá mismo.
            </p>
          </div>
          {crearEnChat ? (
            // G7a: el formulario aparece en el chat, con el nombre ya puesto.
            <Button variant="outline" size="sm" className="gap-2" data-testid="omnibox-crear-en-chat" onClick={() => crearEnChat(consulta)}>
              <PackagePlus className="h-4 w-4" />
              Crear “{consulta}”
            </Button>
          ) : (
            <Button variant="outline" size="sm" asChild className="gap-2">
              <Link to={`/products/create?nombre=${encodeURIComponent(consulta)}`}>
                <PackagePlus className="h-4 w-4" />
                Crear “{consulta}”
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
