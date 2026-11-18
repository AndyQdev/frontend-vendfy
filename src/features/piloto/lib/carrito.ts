import { esUnidadEntera, setVentaEnCurso, ventaEnCurso, type ItemVenta } from "@/entities/order";
import type { ProductoOpcion } from "@/entities/omnibox/model/types";

/**
 * El piloto carga la venta en curso: el mismo carrito que llena la Caja al
 * tocar o escanear. Se busca por `storeProductId` (lo que viaja en el pedido):
 * así una coca dicha y una coca escaneada son la misma fila.
 */

export type ResultadoCarga =
  | { ok: true; id: string; cantidad: number }
  | { ok: false; motivo: "agotado" | "sin_mas"; nombre: string; stock: number };

export function agregarAlCarrito(producto: ProductoOpcion, cantidad: number, precio?: number): ResultadoCarga {
  // Solo la fila del producto entero: los decants y medidas van en filas aparte.
  const actual = ventaEnCurso().find((i) => esUnidadEntera(i) && i.storeProductId === producto.storeProductId);
  const yaHay = actual?.quantity ?? 0;
  const stock = producto.stock;
  if (stock <= 0) return { ok: false, motivo: "agotado", nombre: producto.nombre, stock };
  if (yaHay >= stock) return { ok: false, motivo: "sin_mas", nombre: producto.nombre, stock };

  // No se vende más de lo que hay: entra lo que alcanza y el piloto lo dice.
  const nueva = Math.min(stock, yaHay + cantidad);
  const id = actual?.id ?? producto.storeProductId;
  const fila: ItemVenta = {
    lineId: actual?.lineId ?? id,
    id,
    storeProductId: producto.storeProductId,
    productId: producto.productId,
    name: producto.nombre,
    price: precio ?? actual?.price ?? producto.precio,
    quantity: nueva,
    stock,
    imageUrl: producto.imagen ?? actual?.imageUrl,
  };
  setVentaEnCurso((previa) => (actual ? previa.map((i) => (i.lineId === fila.lineId ? fila : i)) : [...previa, fila]));
  return { ok: true, id, cantidad: nueva };
}

/** La fila de un producto ya cargado. Las cargadas a mano no traen productId: se busca también por nombre. */
function filaDe(productId: string, nombre: string): ItemVenta | undefined {
  const lista = ventaEnCurso();
  return (
    lista.find((i) => i.productId === productId) ??
    lista.find((i) => i.name.toLowerCase() === nombre.toLowerCase())
  );
}

export function quitarDelCarrito(productId: string, nombre: string): boolean {
  const fila = filaDe(productId, nombre);
  if (!fila) return false;
  setVentaEnCurso((previa) => previa.filter((i) => i.id !== fila.id));
  return true;
}

export function cantidadEnCarrito(productId: string, nombre: string, cantidad: number): string | null {
  const fila = filaDe(productId, nombre);
  if (!fila) return null;
  if (cantidad <= 0) {
    setVentaEnCurso((previa) => previa.filter((i) => i.id !== fila.id));
    return null;
  }
  const n = Math.min(cantidad, fila.stock);
  setVentaEnCurso((previa) => previa.map((i) => (i.id === fila.id ? { ...i, quantity: n } : i)));
  return fila.id;
}

export function vaciarCarrito() {
  setVentaEnCurso([]);
}

/** Lo que viaja con cada frase: "que sean 3" o "sacá la coca" necesitan saber qué hay. */
export function lineasDeContexto() {
  return ventaEnCurso()
    .filter((i) => i.productId)
    .map((i) => ({ productId: i.productId!, nombre: i.name, cantidad: i.quantity }));
}
