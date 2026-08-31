import { useEffect, useState } from "react";
import { Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/shared/ui/switch";
import { useSetProductWebVisibility } from "@/entities/product/api";
import type { Product } from "@/entities/product/model/types";

/**
 * El interruptor de "esto se ve en mi tienda web".
 *
 * Apagarlo no borra ni deshabilita nada: el producto sigue con su inventario,
 * su historial y su lugar en la caja, pero desaparece de la vitrina, de su
 * ficha pública y de lo que ve la IA que arma el storefront. Es para el insumo
 * que se fracciona y no se vende suelto, para lo que todavía no llegó y para
 * lo que se vende solo en el mostrador.
 *
 * La visibilidad es POR TIENDA -vive en `store_product`, igual que el precio-,
 * así que en la vista de "todas las tiendas" no hay un interruptor que tenga
 * sentido tocar: ahí se muestra el recuento y se pide elegir una.
 */
export function SwitchWeb({
  product,
  storeId,
}: {
  product: Product;
  /** La tienda activa, o "all" en la vista de todas. */
  storeId: string;
}) {
  const cambiar = useSetProductWebVisibility();

  // Lo que se ve mientras el servidor responde. El interruptor tiene que
  // moverse en el momento en que se lo toca, no medio segundo después.
  const [optimista, setOptimista] = useState<boolean | null>(null);

  const delServidor = product.visibleOnWeb !== false;

  // Cuando la lista vuelve a cargar con el valor ya guardado, se suelta el
  // valor optimista. Soltarlo antes haría parpadear el interruptor.
  useEffect(() => {
    if (optimista !== null && optimista === delServidor) setOptimista(null);
  }, [optimista, delServidor]);

  if (storeId === "all") {
    const enTiendas = product.storeProducts ?? [];
    const visibles = enTiendas.filter((sp) => sp.visibleOnWeb !== false).length;
    const total = enTiendas.length;

    return (
      <span
        title="La visibilidad es de cada tienda. Elegí una arriba para cambiarla."
        className="inline-flex cursor-help items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Globe className="h-3.5 w-3.5" />
        {total === 0 ? "—" : `${visibles}/${total}`}
      </span>
    );
  }

  const visible = optimista ?? delServidor;

  const alternar = async (siguiente: boolean) => {
    setOptimista(siguiente);
    try {
      await cambiar.mutateAsync({
        id: product.id,
        storeId,
        visibleOnWeb: siguiente,
      });
      toast.success(
        siguiente
          ? `"${product.name}" ya se ve en tu tienda web`
          : `"${product.name}" dejó de verse en tu tienda web`,
      );
    } catch {
      // Vuelve solo a como estaba: dejarlo mostrando lo que no se guardó sería
      // peor que no haberlo movido.
      setOptimista(null);
      toast.error("No se pudo cambiar la visibilidad");
    }
  };

  return (
    <span className="inline-flex items-center justify-center">
      {cambiar.isPending && optimista !== null ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <Switch
          checked={visible}
          onCheckedChange={alternar}
          aria-label={
            visible
              ? `Ocultar ${product.name} de la tienda web`
              : `Mostrar ${product.name} en la tienda web`
          }
          title={
            visible
              ? "Se ve en tu tienda web"
              : "Oculto: no aparece en tu tienda web"
          }
        />
      )}
    </span>
  );
}
