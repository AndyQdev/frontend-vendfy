import { Globe } from "lucide-react";

import { useStore } from "@/app/providers/auth";
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
  const slug = selectedStore && selectedStore !== "all" ? selectedStore.slug : null;
  const storeUrl = slug ? `${PUBLIC_URL}/${slug}` : null;

  return (
    <div
      className={cn(
        "flex flex-none items-center gap-1",
        "lg:h-[var(--alto-burbuja)] lg:gap-1.5 lg:rounded-2xl lg:border lg:border-border lg:bg-card lg:px-2 lg:shadow-card",
        className
      )}
    >
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

      <UserMenu storeUrl={storeUrl} />
    </div>
  );
}
