import type { ProductoOpcion } from "@/entities/omnibox/model/types";
import type { ResultadoEscaneo } from "@/entities/product/model/escaneo";

/**
 * Un código que pasó por la pistola, en el chat del asistente.
 *
 * Queda en el hilo como un mensaje más (lo que se escaneó y qué se hizo), y
 * no pregunta lo que ya se sabe:
 * - con la venta o la compra abierta, el producto entra ahí, como en Caja;
 * - si no, la tarjeta ofrece Vender o Comprar;
 * - si la tienda no lo tiene, la misma tarjeta es el formulario para crearlo,
 *   lleno con lo que sabe el catálogo (foto, nombre, marca).
 *
 * Puro: se prueba sin navegador.
 */
export interface EscaneoChat {
  /** Lo que leyó la pistola. */
  codigo: string;
  /** Lo que devolvió la búsqueda. null mientras se busca. */
  resultado: ResultadoEscaneo | null;
  /** El producto en ESTA tienda: ya estaba, o se acaba de crear. */
  producto: ProductoOpcion | null;
  estado: EstadoEscaneo;
  /** Se creó desde la tarjeta: lo dice arriba de Vender / Comprar. */
  creado?: boolean;
  /** Lo que se hizo con él: "Agregado a la venta · Coca-Cola 2 L · Bs 12,00". */
  resumen?: string;
  error?: string;
}

export type EstadoEscaneo =
  | "buscando"
  /** Está en la tienda: ¿vender o comprar? */
  | "elegir"
  /** La tienda no lo tiene: el formulario para crearlo. */
  | "nuevo"
  | "creando"
  /** Ya se agregó a la venta o a la compra. */
  | "hecho"
  /** Está registrado, pero no se vende en esta tienda. */
  | "otra_tienda"
  | "error"
  | "descartado";

/** El producto escaneado como lo usa la mesa, con el precio y el stock de ESTA tienda. */
export function opcionDeEscaneo(r: ResultadoEscaneo, storeId: string): ProductoOpcion | null {
  const p = r.producto;
  const t = p?.tiendas.find((x) => x.storeId === storeId);
  if (!p || !t) return null;
  return {
    storeProductId: t.storeProductId,
    productId: p.id,
    nombre: p.name,
    codigo: p.sku ?? null,
    imagen: p.imageUrls[0] ?? null,
    precio: Number(t.price),
    stock: Number(t.stock),
    similitud: 1,
  };
}

/** Qué hacer con un producto que ya está, según la mesa que se tiene abierta. */
export function destinoDirecto(abierta: string | null): "venta" | "compra" | null {
  return abierta === "venta" || abierta === "compra" ? abierta : null;
}

/** Cómo sigue la tarjeta según lo que se encontró. */
export function estadoInicial(r: ResultadoEscaneo, storeId: string): EstadoEscaneo {
  if (!r.producto) return "nuevo";
  return opcionDeEscaneo(r, storeId) ? "elegir" : "otra_tienda";
}

function bs(n: number): string {
  return `Bs ${n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function resumenVenta(p: ProductoOpcion): string {
  return `Agregado a la venta · ${p.nombre} · ${bs(p.precio)}`;
}

export function resumenCompra(p: ProductoOpcion, costo: number): string {
  return `Cargado a la compra · ${p.nombre}${costo > 0 ? ` a ${bs(costo)}` : ""}`;
}

/**
 * Lo que se le contestó, en una línea, para la memoria corta: así "vendé 3 de
 * esos" después de escanear sabe de qué producto se habla.
 */
export function respuestaDeEscaneo(e: EscaneoChat): string | null {
  if (e.estado === "buscando") return null;
  if (e.estado === "hecho" && e.resumen) return e.resumen;
  if (e.producto) return `Escaneó ${e.producto.nombre}: ${bs(e.producto.precio)}, stock ${e.producto.stock}`;
  if (e.estado === "otra_tienda" && e.resultado?.producto) return `Escaneó ${e.resultado.producto.name}: no se vende en esta tienda`;
  if (e.estado === "nuevo" || e.estado === "creando") {
    const s = e.resultado?.sugerencia;
    return s ? `Escaneó un código que no está en la tienda (según el catálogo es ${s.nombre})` : "Escaneó un código que no está en la tienda";
  }
  if (e.estado === "error") return e.error ? `Error: ${e.error}` : null;
  return null;
}

/**
 * Al guardar la conversación, lo que estaba en camino no va a llegar: una
 * búsqueda cortada queda como error y un alta a medias vuelve al formulario.
 */
export function escaneoGuardable(e: EscaneoChat): EscaneoChat {
  if (e.estado === "buscando") return { ...e, estado: "error", error: "Se cortó la búsqueda. Escanealo de nuevo." };
  if (e.estado === "creando") return { ...e, estado: "nuevo" };
  return e;
}
