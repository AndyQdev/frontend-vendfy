import { useEffect, useState } from "react";
import { Globe, Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/shared/ui/switch";
import { useSetProductStoreFlag } from "@/entities/product/api";
import type { Product } from "@/entities/product/model/types";
import { useAcceso } from "@/app/providers/acceso";
import { PERMISO } from "@/shared/acceso/permisos";

/**
 * Los interruptores por tienda de la tabla de productos.
 *
 * Son dos decisiones distintas sobre el mismo producto, y las dos viven en
 * `store_product` -junto al precio- porque dependen de la tienda:
 *
 *   Web       ¿se muestra en mi tienda online?
 *   A pedido  ¿se puede comprar aunque no tenga stock?
 *
 * Ninguno borra ni deshabilita nada: el producto conserva su inventario, su
 * historial y su lugar en la caja. Por eso en la vista de "todas las tiendas"
 * no hay interruptor que tenga sentido tocar: ahí se muestra el recuento y se
 * pide elegir una.
 */
type Bandera = "visibleOnWeb" | "sellWithoutStock";

const TEXTOS: Record<
  Bandera,
  {
    encendido: string;
    apagado: string;
    avisoOn: (n: string) => string;
    avisoOff: (n: string) => string;
    accionOn: (n: string) => string;
    accionOff: (n: string) => string;
    ayudaTodas: string;
  }
> = {
  visibleOnWeb: {
    encendido: "Se ve en tu tienda web",
    apagado: "Oculto: no aparece en tu tienda web",
    avisoOn: (n) => `"${n}" ya se ve en tu tienda web`,
    avisoOff: (n) => `"${n}" dejó de verse en tu tienda web`,
    accionOn: (n) => `Mostrar ${n} en la tienda web`,
    accionOff: (n) => `Ocultar ${n} de la tienda web`,
    ayudaTodas: "La visibilidad es de cada tienda. Elige una arriba para cambiarla.",
  },
  sellWithoutStock: {
    encendido: "A pedido: se puede comprar aunque no haya stock",
    apagado: "Solo con stock: sin existencias no se puede pedir",
    avisoOn: (n) => `"${n}" ya se puede pedir sin stock`,
    avisoOff: (n) => `"${n}" solo se vende con stock`,
    accionOn: (n) => `Permitir pedir ${n} sin stock`,
    accionOff: (n) => `Dejar de vender ${n} sin stock`,
    ayudaTodas: "Se configura por tienda. Elige una arriba para cambiarlo.",
  },
};

export function SwitchTienda({
  product,
  storeId,
  campo = "visibleOnWeb",
}: {
  product: Product;
  /** La tienda activa, o "all" en la vista de todas. */
  storeId: string;
  campo?: Bandera;
}) {
  const cambiar = useSetProductStoreFlag();
  const textos = TEXTOS[campo];
  // Mostrar u ocultar en la web, o vender a pedido, es editar el producto.
  const editable = useAcceso().puede(PERMISO.GESTIONAR_PRODUCTOS);

  // Lo que se ve mientras el servidor responde. El interruptor tiene que
  // moverse en el momento en que se lo toca, no medio segundo después.
  const [optimista, setOptimista] = useState<boolean | null>(null);

  // "Se ve en la web" nace encendido; "a pedido" nace apagado, porque
  // prometerle al cliente que se lo conseguís es una decisión, no un default.
  const delServidor =
    campo === "visibleOnWeb"
      ? product.visibleOnWeb !== false
      : product.sellWithoutStock === true;

  // Cuando la lista vuelve a cargar con el valor ya guardado, se suelta el
  // valor optimista. Soltarlo antes haría parpadear el interruptor.
  useEffect(() => {
    if (optimista !== null && optimista === delServidor) setOptimista(null);
  }, [optimista, delServidor]);

  if (storeId === "all") {
    const enTiendas = product.storeProducts ?? [];
    const visibles = enTiendas.filter((sp) =>
      campo === "visibleOnWeb"
        ? sp.visibleOnWeb !== false
        : sp.sellWithoutStock === true,
    ).length;
    const total = enTiendas.length;

    return (
      <span
        title={textos.ayudaTodas}
        className="inline-flex cursor-help items-center gap-1.5 text-xs text-muted-foreground"
      >
        {campo === "visibleOnWeb" ? (
          <Globe className="h-3.5 w-3.5" />
        ) : (
          <Truck className="h-3.5 w-3.5" />
        )}
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
        campo,
        valor: siguiente,
      });
      toast.success(
        siguiente ? textos.avisoOn(product.name) : textos.avisoOff(product.name),
      );
    } catch {
      // Vuelve solo a como estaba: dejarlo mostrando lo que no se guardó sería
      // peor que no haberlo movido.
      setOptimista(null);
      toast.error("No se pudo guardar el cambio");
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
          disabled={!editable}
          aria-label={
            visible
              ? textos.accionOff(product.name)
              : textos.accionOn(product.name)
          }
          title={visible ? textos.encendido : textos.apagado}
        />
      )}
    </span>
  );
}
