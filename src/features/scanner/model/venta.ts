import { esUnidadEntera, setVentaEnCurso, ventaEnCurso, type ItemVenta } from "@/entities/order";
import type { ResultadoEscaneo, TiendaDelProducto } from "@/entities/product/model/escaneo";
import type { FraseVoz } from "@/shared/voz";

/**
 * De dónde se vende lo escaneado: la tienda elegida arriba; con "Todas",
 * la primera que lo tiene en stock (o la primera, para avisar que no hay).
 */
export function tiendaParaVender(r: ResultadoEscaneo, tiendaId: string | null): TiendaDelProducto | null {
  const tiendas = r.producto?.tiendas ?? [];
  if (tiendaId) return tiendas.find((t) => t.storeId === tiendaId) ?? null;
  return tiendas.find((t) => t.stock > 0) ?? tiendas[0] ?? null;
}

export type ResultadoAgregar =
  | { ok: true; item: ItemVenta; cantidad: number; tienda: TiendaDelProducto }
  | { ok: false; motivo: "sin_tienda" | "agotado" | "sin_mas"; tienda: TiendaDelProducto | null };

/**
 * Suma una unidad a la venta en curso (el carrito de Caja), desde cualquier
 * pantalla. No deja pasar del stock: lo mismo que se cobraría en Caja.
 */
export function agregarAVenta(r: ResultadoEscaneo, tiendaId: string | null): ResultadoAgregar {
  const producto = r.producto;
  const tienda = producto ? tiendaParaVender(r, tiendaId) : null;
  if (!producto || !tienda?.inventoryId) return { ok: false, motivo: "sin_tienda", tienda };

  // La misma fila aunque la haya cargado el piloto (que la guarda por storeProductId).
  // Solo la del producto entero: los decants y medidas van en filas aparte.
  const fila = ventaEnCurso().find(
    (i) => esUnidadEntera(i) && (i.id === tienda.inventoryId || i.storeProductId === tienda.storeProductId),
  );
  const yaEnVenta = fila?.quantity ?? 0;
  if (tienda.stock <= yaEnVenta) {
    return { ok: false, motivo: tienda.stock <= 0 ? "agotado" : "sin_mas", tienda };
  }

  const item: ItemVenta = {
    lineId: fila?.lineId ?? tienda.inventoryId,
    id: fila?.id ?? tienda.inventoryId,
    storeProductId: tienda.storeProductId,
    name: producto.name,
    price: tienda.price,
    quantity: yaEnVenta + 1,
    stock: tienda.stock,
    imageUrl: producto.imageUrls[0],
  };
  setVentaEnCurso((previa) =>
    previa.some((i) => i.lineId === item.lineId)
      ? previa.map((i) => (i.lineId === item.lineId ? { ...i, quantity: i.quantity + 1, stock: tienda.stock } : i))
      : [...previa, item],
  );
  return { ok: true, item, cantidad: yaEnVenta + 1, tienda };
}

/**
 * Lo que dice la voz al abrir la ficha: solo el precio ("Doce bolivianos con
 * cincuenta."). El stock no se dice: se ve en la ficha.
 */
export function frasesDeFicha(r: ResultadoEscaneo, tiendaId: string | null): FraseVoz[] {
  const producto = r.producto;
  if (!producto) return [];
  const tienda = producto.tiendas.find((t) => t.storeId === tiendaId) ?? producto.tiendas[0];
  return tienda ? [{ tipo: "precio", monto: tienda.price, moneda: tienda.currency }] : [];
}

/**
 * Lo que dice la voz al cargarlo en la venta (Caja): solo el precio, entre o no.
 * Si no entró (agotado, ya están todos), lo avisan el bip de error y el toast.
 */
export function frasesAlAgregar(resultado: ResultadoAgregar): FraseVoz[] {
  const tienda = resultado.tienda;
  return tienda ? [{ tipo: "precio", monto: tienda.price, moneda: tienda.currency }] : [];
}
