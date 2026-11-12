import { Globe } from "lucide-react";

import { useStore } from "@/app/providers/auth";
import { useStore as useStoreQuery } from "@/entities/store/api";
import { BotonReportar } from "@/features/beta";
import { ModoEscaner } from "@/features/scanner";
import { cn } from "@/shared/lib/cn";

import { NotificationsBell } from "./NotificationsBell";
import { UserMenu } from "./UserMenu";

const PUBLIC_URL = (import.meta.env.VITE_URL_PUBLIC as string | undefined) || "https://compras.vendfy.shop";

/**
 * BLOQUE DERECHO — avisos, tienda online y perfil.
 *
 * En escritorio es una burbuja blanca como la del carril. En el teléfono se
 * desarma: quedan la campana y el menú, sueltos sobre el fondo, y el globo
 * pasa adentro del menú.
 */
export function HeaderActions({ className }: { className?: string }) {
  const { selectedStore } = useStore();
  const tienda = selectedStore && selectedStore !== "all" ? selectedStore : null;
  const slug = tienda?.slug ?? null;

  // La tienda guardada en el navegador es una copia congelada del momento en
  // que se la eligió: no trae `config` y, aunque lo trajera, quedaría vieja al
  // editar la dirección. Se relee de la base para que la web elegida valga
  // desde cualquier dispositivo y sesión.
  const { data: datosTienda } = useStoreQuery(tienda?.id);

  // La de Vendfy siempre existe: se arma con el slug.
  const urlVendfy = slug ? `${PUBLIC_URL}/${slug}` : null;

  // La propia, si el comerciante la publicó y pegó su dirección en
  // Tienda → Diseño → Tu web con IA. Viene de la base, no del navegador, así
  // que vale desde cualquier dispositivo y sesión.
  const urlPropia = datosTienda?.config?.storefront?.url?.trim() || null;

  // El globo abre la que el comerciante enseña; la de Vendfy queda accesible
  // desde el menú, porque ahí viven el Modo Live y el seguimiento de pedidos.
  const storeUrl = urlPropia ?? urlVendfy;
  const urlAlterna = urlPropia && urlVendfy && urlPropia !== urlVendfy ? urlVendfy : null;

  return (
    <div
      className={cn(
        "flex flex-none items-center gap-1",
        "lg:h-[var(--alto-burbuja)] lg:gap-1.5 lg:rounded-2xl lg:border lg:border-border lg:bg-card lg:px-2 lg:shadow-card",
        className
      )}
    >
      {/* Qué hace la pistola en esta pantalla (solo si ya se usó una). */}
      <ModoEscaner />

      {/* Solo aparece si la tienda está en una beta. */}
      <BotonReportar />

      <NotificationsBell />

      {storeUrl ? (
        <a
          href={storeUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Ver la tienda online"
          title="Ver la tienda online"
          className={cn(
            "hidden size-9 flex-none place-items-center rounded-full bg-muted text-foreground transition-colors lg:grid",
            "hover:bg-tinta hover:text-tinta-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <Globe className="size-4" />
        </a>
      ) : null}

      <span aria-hidden className="mx-0.5 hidden h-6 w-px bg-border lg:block" />

      <UserMenu storeUrl={storeUrl} urlVendfy={urlAlterna} />
    </div>
  );
}
