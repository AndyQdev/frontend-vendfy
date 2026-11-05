import type { ComponentType } from "react";
import {
  Calculator,
  ClipboardList,
  House,
  Layers,
  Radio,
  MessageSquareText,
  Megaphone,
  BadgePercent,
  Package,
  ChartColumnBig,
  ReceiptText,
  Plug,
  Store,
  Tags,
  Truck,
  Users,
} from "lucide-react";
import { IconBrandWhatsapp } from "@tabler/icons-react";

/**
 * El mapa de navegación del panel: una sola lista, en el orden del día de
 * trabajo. La leen el carril del header (escritorio y teléfono) y nada más,
 * así que no hay dos menús que se puedan desincronizar.
 *
 * No hay menú "Más" ni rutas escondidas: todas entran en el carril, que se
 * desplaza de costado. Es la decisión que tomó Cell Diagnostic con dieciocho
 * rutas y la razón de que el header se lea de un vistazo.
 */
export interface NavRoute {
  /** Adónde lleva. Puede depender de la tienda elegida (ver `resolveHref`). */
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /**
   * Prefijo con el que la ruta se marca activa. Por defecto es `href`.
   * Gana el prefijo MÁS LARGO: /products/taxonomies activa "Marcas y
   * categorías" y no "Productos", aunque las dos coincidan.
   */
  match?: string;
  /** Contador rojo: de dónde sale el número. */
  badge?: "pending-orders";
  /** El ícono va en el verde de la marca (solo WhatsApp). */
  brandTint?: "whatsapp";
}

export const NAV_ROUTES: NavRoute[] = [
  // El asistente va primero: es la puerta de entrada del comerciante.
  { href: "/omnibox", label: "Asistente", icon: MessageSquareText },
  { href: "/dashboard", label: "Inicio", icon: House },
  { href: "/caja", label: "Caja", icon: Calculator },
  { href: "/orders", label: "Pedidos", icon: ClipboardList, badge: "pending-orders" },
  { href: "/sales", label: "Ventas", icon: ReceiptText },
  { href: "/products", label: "Productos", icon: Package },
  // Las promociones, también pegadas a Productos: es rebajarlos, con página propia.
  { href: "/promotions", label: "Promociones", icon: BadgePercent },
  // El Live va pegado a Productos: es otra forma de ponerlos a la venta.
  { href: "/live", label: "Modo Live", icon: Radio, match: "/live" },
  { href: "/inventory", label: "Inventario", icon: Layers },
  { href: "/purchases", label: "Compras", icon: Truck },
  { href: "/customers", label: "Clientes", icon: Users },
  // Leer el negocio, después de las pantallas con las que se opera.
  { href: "/reports", label: "Reportes", icon: ChartColumnBig, match: "/reports" },
  // Los canales por donde llega el cliente, juntos.
  { href: "/whatsapp", label: "WhatsApp", icon: IconBrandWhatsapp, brandTint: "whatsapp" },
  { href: "/campaigns", label: "Campañas", icon: Megaphone },
  // Lo que se configura, al final.
  { href: "/integrations", label: "Integraciones", icon: Plug },
  { href: "/products/taxonomies", label: "Marcas y categorías", icon: Tags },
  { href: "/stores", label: "Tienda", icon: Store, match: "/stores" },
];

// OJO: "Campañas" y "Reportes" apuntan hoy a pantallas
// prácticamente vacías -un título y nada más-. Están en el carril a propósito,
// para ver el conjunto y decidir el flujo; no son funcionalidad terminada.
// Si se decide que alguna no va, se saca de acá y se borra su `pages/`.

/** La ruta de la tienda depende de si hay una elegida o están "todas". */
export function resolveHref(route: NavRoute, storeId: string | null): string {
  if (route.href === "/stores" && storeId) return `/stores/${storeId}`;
  return route.href;
}

export function resolveLabel(route: NavRoute, storeId: string | null): string {
  if (route.href === "/stores" && !storeId) return "Tiendas";
  return route.label;
}

/** La ruta activa para un pathname: la de prefijo más largo que coincida. */
export function activeRouteFor(pathname: string): NavRoute | undefined {
  let best: NavRoute | undefined;
  let bestLength = -1;
  for (const route of NAV_ROUTES) {
    const prefix = route.match ?? route.href;
    const hit = pathname === prefix || pathname.startsWith(`${prefix}/`);
    if (hit && prefix.length > bestLength) {
      best = route;
      bestLength = prefix.length;
    }
  }
  return best;
}
