import { Link, useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useStore } from "@/app/providers/auth";
import { usePendingOrdersCount } from "@/entities/order/api";
import { cn } from "@/shared/lib/cn";

import { NAV_ROUTES, activeRouteFor, resolveHref, resolveLabel, type NavRoute } from "../model/routes";
import { useRail } from "../model/use-rail";

/**
 * EL CARRIL DE RUTAS.
 *
 * Todas las rutas en una sola fila que se desplaza de costado. Nunca se parte
 * en dos renglones y nunca se comprime hasta volverse ilegible: cada ruta
 * conserva su ancho natural.
 *
 *  - Escritorio: vive dentro de la burbuja blanca central. Si no entra, aparecen
 *    las flechas —solo la del lado donde hay algo— y también se puede deslizar
 *    con el trackpad.
 *  - Teléfono y tablet: segunda fila del header, sobre el fondo, deslizable con
 *    el dedo y sin flechas. Lo único que se mueve de costado en toda la app.
 */
export function NavigationRail({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const { selectedStore } = useStore();
  const storeId = selectedStore && selectedStore !== "all" ? selectedStore.id : null;

  const active = activeRouteFor(pathname);
  const { railRef, canBack, canForward, scrollBy } = useRail(active?.href);

  const { data: pendingOrders = 0 } = usePendingOrdersCount(storeId ?? undefined);

  return (
    <div
      className={cn(
        "flex min-w-0 items-center",
        // Escritorio: la burbuja blanca.
        "lg:h-[var(--alto-burbuja)] lg:rounded-2xl lg:border lg:border-border lg:bg-card lg:px-2 lg:shadow-card",
        className
      )}
    >
      {canBack ? <RailArrow direction={-1} onClick={() => scrollBy(-1)} /> : null}

      <nav
        ref={railRef}
        aria-label="Navegación principal"
        className={cn(
          "carril relative flex min-w-0 flex-1 items-center gap-1",
          // En el teléfono el carril llega a los bordes de la pantalla: se ve
          // que sigue, sin necesidad de flechas.
          "-mx-3 px-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0"
        )}
      >
        {NAV_ROUTES.map((route) => (
          <RailItem
            key={route.href}
            route={route}
            href={resolveHref(route, storeId)}
            label={resolveLabel(route, storeId)}
            active={active?.href === route.href}
            badge={route.badge === "pending-orders" ? pendingOrders : 0}
          />
        ))}
      </nav>

      {canForward ? <RailArrow direction={1} onClick={() => scrollBy(1)} /> : null}
    </div>
  );
}

function RailItem({
  route,
  href,
  label,
  active,
  badge,
}: {
  route: NavRoute;
  href: string;
  label: string;
  active: boolean;
  badge: number;
}) {
  const Icon = route.icon;

  return (
    <Link
      to={href}
      data-route={route.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 flex-none items-center gap-2 whitespace-nowrap rounded-[12px] px-3 text-[13px] font-semibold lg:h-9",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        active ? "bg-tinta text-tinta-foreground" : "text-foreground/75 hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon
        className={cn(
          "size-4 flex-none",
          route.brandTint === "whatsapp" && !active && "text-[#25D366]"
        )}
      />
      <span>{label}</span>
      {badge > 0 ? (
        <span
          aria-label={`${badge} por atender`}
          className="cifra grid h-[18px] min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground"
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

/** Solo en escritorio, y solo si hay algo de ese lado. */
function RailArrow({ direction, onClick }: { direction: 1 | -1; onClick: () => void }) {
  const label = direction === 1 ? "Ver las rutas siguientes" : "Ver las rutas anteriores";
  const Icon = direction === 1 ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "hidden size-[30px] flex-none place-items-center rounded-full bg-tinta text-tinta-foreground transition-colors hover:bg-primary lg:grid",
        direction === 1 ? "ml-1.5" : "mr-1.5"
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.4} />
    </button>
  );
}
