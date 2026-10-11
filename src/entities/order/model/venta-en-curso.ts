import { useSyncExternalStore } from "react";

/**
 * La venta que se está armando: el carrito de Caja.
 *
 * Vive fuera de la pantalla para que se pueda cargar desde cualquier lado
 * (escanear en Inventario → "Agregar a la venta") y para que no se pierda al
 * ir a otra pantalla o recargar. Se descarta sola si quedó abandonada.
 */
export interface ItemVenta {
  /** Fila de inventario (stock en una tienda). */
  id: string;
  storeProductId: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
  imageUrl?: string;
}

const CLAVE = "vendfy.venta-en-curso.v1";
/** Una venta que nadie tocó en medio día ya no es la de este cliente. */
const VENCE_MS = 12 * 60 * 60 * 1000;

function leer(): ItemVenta[] {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? "null") as { items: ItemVenta[]; t: number } | null;
    if (guardado && Date.now() - guardado.t < VENCE_MS && Array.isArray(guardado.items)) return guardado.items;
  } catch {
    // arranca vacía
  }
  return [];
}

let items = leer();
const oyentes = new Set<() => void>();

export function ventaEnCurso(): ItemVenta[] {
  return items;
}

export type CambioVenta = ItemVenta[] | ((previa: ItemVenta[]) => ItemVenta[]);

export function setVentaEnCurso(cambio: CambioVenta) {
  items = typeof cambio === "function" ? cambio(items) : cambio;
  try {
    if (items.length) localStorage.setItem(CLAVE, JSON.stringify({ items, t: Date.now() }));
    else localStorage.removeItem(CLAVE);
  } catch {
    // dura la sesión
  }
  oyentes.forEach((f) => f());
}

function suscribir(f: () => void) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

/** Igual que un useState: `[items, setItems]`. */
export function useVentaEnCurso(): [ItemVenta[], typeof setVentaEnCurso] {
  return [useSyncExternalStore(suscribir, ventaEnCurso, ventaEnCurso), setVentaEnCurso];
}

export function totalesVenta(lista: ItemVenta[]) {
  return {
    unidades: lista.reduce((s, i) => s + i.quantity, 0),
    total: lista.reduce((s, i) => s + i.price * i.quantity, 0),
  };
}
