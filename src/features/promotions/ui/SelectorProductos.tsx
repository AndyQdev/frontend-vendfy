import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";

import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { useProducts } from "@/entities/product/api";

/** Un producto de la tienda, con lo mínimo para elegirlo y reconocerlo. */
export interface ProductoElegible {
  productId: string;
  storeProductId: string;
  nombre: string;
  imagen: string | null;
  precio: number;
}

/** Lo que trae el servidor por consulta. Con más que esto se busca por nombre. */
const POR_CONSULTA = 50;
const RETARDO = 300;

/**
 * Elegir productos de la tienda, buscando por nombre. Lo elegido se guarda
 * entero (no solo el id): así sigue a la vista aunque la búsqueda cambie, y
 * los avisos de "elegí hasta N" no dependen de qué lista se está mirando.
 */
export function SelectorProductos({
  storeId,
  value,
  onChange,
  max,
}: {
  storeId: string;
  value: ProductoElegible[];
  onChange: (productos: ProductoElegible[]) => void;
  max: number;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [consulta, setConsulta] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setConsulta(busqueda.trim()), RETARDO);
    return () => clearTimeout(t);
  }, [busqueda]);

  const { data, isLoading } = useProducts({
    storeId,
    limit: POR_CONSULTA,
    ...(consulta && { attr: "name", value: consulta }),
  });

  const lista: ProductoElegible[] = (data?.data ?? []).flatMap((p) => {
    const storeProductId = p.storeProducts?.[0]?.id;
    return storeProductId
      ? [{ productId: p.id, storeProductId, nombre: p.name, imagen: p.imageUrls?.[0] ?? null, precio: Number(p.price ?? 0) }]
      : [];
  });

  const elegido = (id: string) => value.some((v) => v.storeProductId === id);
  const alternar = (p: ProductoElegible) =>
    onChange(elegido(p.storeProductId) ? value.filter((v) => v.storeProductId !== p.storeProductId) : [...value, p]);
  const lleno = value.length >= max;

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((p) => (
            <span key={p.storeProductId} className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 py-1 pl-2.5 pr-1 text-xs">
              <span className="truncate">{p.nombre}</span>
              <button
                type="button"
                onClick={() => alternar(p)}
                aria-label={`Quitar ${p.nombre}`}
                className="rounded-full p-0.5 hover:bg-primary/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar un producto…" className="pl-9" />
      </div>

      <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
        {isLoading && <p className="p-3 text-sm text-muted-foreground">Cargando…</p>}
        {!isLoading && lista.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">{consulta ? "Ningún producto coincide." : "Esta tienda todavía no tiene productos."}</p>
        )}
        <ul className="divide-y divide-border">
          {lista.map((p) => {
            const marcado = elegido(p.storeProductId);
            const bloqueado = lleno && !marcado;
            return (
              <li key={p.storeProductId}>
                <label className={`flex cursor-pointer items-center gap-3 p-2.5 ${bloqueado ? "cursor-not-allowed opacity-50" : "hover:bg-muted/40"}`}>
                  <Checkbox checked={marcado} disabled={bloqueado} onCheckedChange={() => alternar(p)} />
                  <span className="h-10 w-10 flex-none overflow-hidden rounded-md bg-muted">
                    {p.imagen && <img src={p.imagen} alt="" className="h-full w-full object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.nombre}</span>
                    <span className="block text-xs text-muted-foreground">Bs {p.precio.toFixed(2)}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">
        {value.length} de {max} {lleno ? "· llegaste al máximo" : ""}
      </p>
    </div>
  );
}
