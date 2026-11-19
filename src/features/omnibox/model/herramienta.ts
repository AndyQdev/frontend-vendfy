import type { HerramientaGenerada, TablaVista, VistaSpec } from "@/entities/omnibox/model/types";

/**
 * Lo que propone una herramienta a medida (G6), antes de mostrarlo.
 *
 * El código lo escribió la IA y corre aislado: lo que manda por `proponer`
 * no se cree. Se contrasta contra la foto de datos con que se armó: solo
 * productos que estaban ahí, precios que son números y mayores a cero. Lo
 * que pase queda como una propuesta N1 más, con su tarjeta de confirmación:
 * nada se aplica sin que la persona lo revise.
 *
 * Puro: se prueba en e2e/logic/herramienta.spec.ts.
 */

export const MAX_CAMBIOS = 100;
/** Un cambio de más del 50 % se marca en la tarjeta: puede ser un error de la herramienta. */
export const CAMBIO_GRANDE = 0.5;

export interface CambioPrecio {
  productId: string;
  producto: string;
  antes: number | null;
  precio: number;
  /** Más del 50 % arriba o abajo. */
  grande: boolean;
}

export interface PropuestaPrecios {
  tipo: "precios";
  cambios: CambioPrecio[];
  motivo: string;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Los productos de la foto de datos, por id: de donde sale el nombre y el precio actual. */
function productosDe(datos: Record<string, TablaVista>): Map<string, { producto: string; precio: number | null }> {
  const mapa = new Map<string, { producto: string; precio: number | null }>();
  for (const tabla of Object.values(datos)) {
    for (const f of tabla.filas) {
      const id = f._productId;
      if (typeof id !== "string" || mapa.has(id)) continue;
      const precio = typeof f._precio === "number" ? f._precio : typeof f.precio === "number" ? f.precio : null;
      mapa.set(id, { producto: String(f.producto ?? f.nombre ?? "Producto"), precio });
    }
  }
  return mapa;
}

/** La propuesta lista para la tarjeta, o por qué no se puede mostrar. */
export function validarPropuesta(
  accion: unknown,
  datos: Record<string, TablaVista>,
): { propuesta: PropuestaPrecios; error?: never } | { propuesta?: never; error: string } {
  const a = accion as { tipo?: unknown; cambios?: unknown; motivo?: unknown } | null;
  if (!a || typeof a !== "object" || a.tipo !== "precios") {
    return { error: "La herramienta propuso algo que todavía no se puede hacer desde acá." };
  }
  if (!Array.isArray(a.cambios) || a.cambios.length === 0) return { error: "La herramienta no propuso ningún cambio." };
  if (a.cambios.length > MAX_CAMBIOS) return { error: `Son demasiados cambios de una vez (máximo ${MAX_CAMBIOS}).` };

  const productos = productosDe(datos);
  const vistos = new Set<string>();
  const cambios: CambioPrecio[] = [];
  for (const c of a.cambios as { productId?: unknown; precio?: unknown }[]) {
    const id = typeof c?.productId === "string" ? c.productId : "";
    const prod = productos.get(id);
    if (!prod) return { error: "La herramienta propuso un producto que no estaba en sus datos." };
    if (vistos.has(id)) return { error: `${prod.producto} aparece dos veces en la propuesta.` };
    vistos.add(id);
    const precio = typeof c.precio === "number" ? c.precio : Number(c.precio);
    if (!Number.isFinite(precio) || precio <= 0) return { error: `El precio propuesto para ${prod.producto} no es válido.` };
    const nuevo = redondear(precio);
    if (prod.precio !== null && nuevo === redondear(prod.precio)) continue;
    const grande = prod.precio !== null && prod.precio > 0 && Math.abs(nuevo - prod.precio) / prod.precio > CAMBIO_GRANDE;
    cambios.push({ productId: id, producto: prod.producto, antes: prod.precio, precio: nuevo, grande });
  }
  if (cambios.length === 0) return { error: "Los precios propuestos son los mismos que ya tienes." };
  const motivo = typeof a.motivo === "string" ? a.motivo.replace(/\s+/g, " ").trim().slice(0, 200) : "";
  return { propuesta: { tipo: "precios", cambios, motivo } };
}

/**
 * Si la herramienta se rompe aun corregida, la respuesta no queda en nada: sus
 * mismos datos, como tablas de un análisis (N2, sin IA). Lo que se leyó para
 * armarla igual sirve para mirar.
 */
export function vistaDeRespaldo(g: HerramientaGenerada): VistaSpec {
  return {
    titulo: g.titulo,
    piezas: g.plan.fuentes.map((f, i) => ({
      id: `datos-${i + 1}`,
      tipo: "tabla" as const,
      fuente: f.fuente,
      params: f.params,
      titulo: f.alias.charAt(0).toUpperCase() + f.alias.slice(1).replace(/_/g, " "),
    })),
  };
}
