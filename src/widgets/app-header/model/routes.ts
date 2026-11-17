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
  UserCog,
  Users,
} from "lucide-react";
import { IconBrandWhatsapp } from "@tabler/icons-react";

import { PERMISO, type Requisito } from "@/shared/acceso/permisos";

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
  /**
   * Qué hace falta para verla: un permiso del rol, una función del plan o
   * ser el dueño. Sin esto la ve todo el equipo. El carril esconde lo que no
   * cumple y la pantalla, si se entra por la dirección, explica por qué.
   */
  requiere?: Requisito;
}

export const NAV_ROUTES: NavRoute[] = [
  // El asistente va primero: es la puerta de entrada del comerciante.
  { href: "/omnibox", label: "Asistente", icon: MessageSquareText },
  { href: "/dashboard", label: "Inicio", icon: House, requiere: { permisos: [PERMISO.VER_REPORTES] } },
  { href: "/caja", label: "Caja", icon: Calculator, requiere: { permisos: [PERMISO.GESTIONAR_PEDIDOS] } },
  { href: "/orders", label: "Pedidos", icon: ClipboardList, badge: "pending-orders", requiere: { permisos: [PERMISO.VER_PEDIDOS] } },
  { href: "/sales", label: "Ventas", icon: ReceiptText, requiere: { permisos: [PERMISO.VER_PEDIDOS] } },
  { href: "/products", label: "Productos", icon: Package, requiere: { permisos: [PERMISO.VER_PRODUCTOS] } },
  // Las promociones, también pegadas a Productos: es rebajarlos, con página propia.
  { href: "/promotions", label: "Promociones", icon: BadgePercent, requiere: { permisos: [PERMISO.VER_MARKETING], funcion: "promociones" } },
  // El Live va pegado a Productos: es otra forma de ponerlos a la venta.
  { href: "/live", label: "Modo Live", icon: Radio, match: "/live", requiere: { permisos: [PERMISO.VER_LIVE], funcion: "live" } },
  { href: "/inventory", label: "Inventario", icon: Layers, requiere: { permisos: [PERMISO.VER_INVENTARIO] } },
  { href: "/purchases", label: "Compras", icon: Truck, requiere: { permisos: [PERMISO.VER_INVENTARIO] } },
  { href: "/customers", label: "Clientes", icon: Users, requiere: { permisos: [PERMISO.VER_CLIENTES] } },
  // Leer el negocio, después de las pantallas con las que se opera.
  { href: "/reports", label: "Reportes", icon: ChartColumnBig, match: "/reports", requiere: { permisos: [PERMISO.VER_REPORTES], funcion: "reportes" } },
  // Los canales por donde llega el cliente, juntos.
  { href: "/whatsapp", label: "WhatsApp", icon: IconBrandWhatsapp, brandTint: "whatsapp", requiere: { permisos: [PERMISO.VER_WHATSAPP], funcion: "whatsapp" } },
  { href: "/campaigns", label: "Campañas", icon: Megaphone, requiere: { permisos: [PERMISO.VER_MARKETING] } },
  // Lo que se configura, al final.
  { href: "/integrations", label: "Integraciones", icon: Plug, requiere: { permisos: [PERMISO.VER_MARKETING], funcion: "anuncios_meta" } },
  { href: "/products/taxonomies", label: "Marcas y categorías", icon: Tags, requiere: { permisos: [PERMISO.VER_CATEGORIAS, PERMISO.VER_MARCAS] } },
  { href: "/stores", label: "Tienda", icon: Store, match: "/stores", requiere: { permisos: [PERMISO.VER_TIENDAS] } },
  // Quién entra al panel, con qué rol y en qué sucursales: solo el dueño.
  { href: "/equipo", label: "Equipo", icon: UserCog, requiere: { soloDueno: true } },
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

/**
 * Pantallas fuera del carril que piden más que su sección: ver productos no
 * alcanza para crear uno. Sin esto, la cajera que toca una fila de Productos
 * terminaría en un formulario que no puede guardar.
 */
const PANTALLAS_DE_EDICION: { patron: RegExp; label: string; requiere: Requisito }[] = [
  { patron: /^\/products\/(create|[0-9a-f-]{36})\/?$/i, label: "Editar productos", requiere: { permisos: [PERMISO.GESTIONAR_PRODUCTOS] } },
  { patron: /^\/purchases\/new\/?$/, label: "Nueva compra", requiere: { permisos: [PERMISO.GESTIONAR_INVENTARIO] } },
  { patron: /^\/stores\/new\/?$/, label: "Nueva tienda", requiere: { soloDueno: true } },
];

/** Lo que pide la pantalla de este pathname: la de edición si es una, si no la de su sección. */
export function requisitoDe(pathname: string): { label: string; requiere: Requisito } | undefined {
  const edicion = PANTALLAS_DE_EDICION.find((p) => p.patron.test(pathname));
  if (edicion) return edicion;
  const ruta = activeRouteFor(pathname);
  return ruta?.requiere ? { label: ruta.label, requiere: ruta.requiere } : undefined;
}

/**
 * La primera pantalla que esta persona puede usar, en el orden del carril.
 * El Asistente no pide nada, así que siempre hay una.
 */
export function primeraRuta(cumple: (req: Requisito) => boolean): string {
  // La Caja primero si se puede: es donde arranca el día. Después, el orden del carril.
  const caja = NAV_ROUTES.find((r) => r.href === "/caja");
  if (caja && (!caja.requiere || cumple(caja.requiere))) return caja.href;
  return NAV_ROUTES.find((r) => !r.requiere || cumple(r.requiere))?.href ?? "/omnibox";
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
