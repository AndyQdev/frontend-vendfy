/**
 * Los nombres de los permisos y de las funciones del plan, tal como los manda
 * el backend (acceso/model/catalogo.ts). Son texto a propósito: el permiso
 * viaja por su nombre y así el panel no depende de ids de la base.
 */
export const PERMISO = {
  VER_PEDIDOS: "Ver pedidos",
  GESTIONAR_PEDIDOS: "Gestionar pedidos",
  VER_PRODUCTOS: "Ver productos",
  GESTIONAR_PRODUCTOS: "Gestionar productos",
  VER_CATEGORIAS: "Ver categorías",
  GESTIONAR_CATEGORIAS: "Gestionar categorías",
  VER_MARCAS: "Ver marcas",
  GESTIONAR_MARCAS: "Gestionar marcas",
  VER_INVENTARIO: "Ver inventario",
  GESTIONAR_INVENTARIO: "Gestionar inventario",
  VER_CLIENTES: "Ver clientes",
  GESTIONAR_CLIENTES: "Gestionar clientes",
  VER_REPORTES: "Ver reportes",
  VER_MARKETING: "Ver marketing",
  GESTIONAR_MARKETING: "Gestionar marketing",
  VER_LIVE: "Ver lives",
  GESTIONAR_LIVE: "Gestionar lives",
  VER_WHATSAPP: "Ver WhatsApp",
  GESTIONAR_WHATSAPP: "Gestionar WhatsApp",
  VER_TIENDAS: "Ver tiendas",
  GESTIONAR_TIENDAS: "Gestionar tiendas",
} as const;

export type Permiso = (typeof PERMISO)[keyof typeof PERMISO];

/** Las funciones que un plan puede incluir o no. */
export type Funcion =
  | "promociones"
  | "reportes"
  | "cuotas_delivery"
  | "live"
  | "anuncios_meta"
  | "whatsapp"
  | "roles_propios";

export const NOMBRE_FUNCION: Record<Funcion, string> = {
  promociones: "Promociones",
  reportes: "Análisis y reportes completos",
  cuotas_delivery: "Cuotas y delivery",
  live: "Live con subastas",
  anuncios_meta: "Anuncios de Meta",
  whatsapp: "Agente de WhatsApp",
  roles_propios: "Roles a medida",
};

export type Limites = Partial<Record<"tiendas" | "usuarios" | "consultasAsistente" | "facturas", number>>;

/** Lo que el backend dice de quien entró (viene con el usuario en login y checkToken). */
export interface Acceso {
  esDueno: boolean;
  plataforma: boolean;
  negocio: { id: string; name: string };
  rol: string;
  permisos: string[];
  funciones: Funcion[];
  limites: Limites;
  plan: { codigo: string; nombre: string };
  suspendida: boolean;
  sucursalesLimitadas: boolean;
  debeCambiarClave: boolean;
}

/** Lo que pide una pantalla o un botón para mostrarse. */
export interface Requisito {
  /** Alcanza con tener uno de estos. */
  permisos?: readonly string[];
  /** El plan tiene que incluirla. */
  funcion?: Funcion;
  /** Alcanza con que el plan incluya una de estas. */
  funciones?: readonly Funcion[];
  /** Solo el dueño (su equipo, abrir tiendas). */
  soloDueno?: boolean;
}

export type Motivo = "ok" | "permiso" | "plan" | "dueno";

/**
 * ¿Cumple? Y si no, por qué: no es lo mismo "tu rol no puede" (hablá con el
 * dueño) que "tu plan no lo incluye" (cambiá de plan).
 *
 * Sin `acceso` (una sesión de antes de esta versión) se deja pasar todo: el
 * backend igual decide, y así nadie queda sin panel por un dato que falta.
 */
export function evaluar(acceso: Acceso | undefined | null, req: Requisito): Motivo {
  if (!acceso || acceso.plataforma) return "ok";
  if (req.funcion && !acceso.funciones.includes(req.funcion)) return "plan";
  if (req.funciones?.length && !req.funciones.some((f) => acceso.funciones.includes(f))) return "plan";
  if (req.soloDueno && !acceso.esDueno) return "dueno";
  if (!acceso.esDueno && req.permisos?.length && !req.permisos.some((p) => acceso.permisos.includes(p))) {
    return "permiso";
  }
  return "ok";
}
