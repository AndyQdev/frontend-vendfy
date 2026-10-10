import { setVentaEnCurso, ventaEnCurso, type ItemVenta } from "@/entities/order";
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

  const yaEnVenta = ventaEnCurso().find((i) => i.id === tienda.inventoryId)?.quantity ?? 0;
  if (tienda.stock <= yaEnVenta) {
    return { ok: false, motivo: tienda.stock <= 0 ? "agotado" : "sin_mas", tienda };
  }

  const item: ItemVenta = {
    id: tienda.inventoryId,
    storeProductId: tienda.storeProductId,
    name: producto.name,
    price: tienda.price,
    quantity: yaEnVenta + 1,
    stock: tienda.stock,
    imageUrl: producto.imageUrls[0],
  };
  setVentaEnCurso((previa) =>
    previa.some((i) => i.id === item.id)
      ? previa.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1, stock: tienda.stock } : i))
      : [...previa, item],
  );
  return { ok: true, item, cantidad: yaEnVenta + 1, tienda };
}

/**
 * Lo que dice la voz al abrir la ficha: el precio y, si importa, el stock.
 * "Doce bolivianos con cincuenta. Quedan dos."
 */
export function frasesDeFicha(r: ResultadoEscaneo, tiendaId: string | null): FraseVoz[] {
  const producto = r.producto;
  if (!producto) return [];
  const tienda = producto.tiendas.find((t) => t.storeId === tiendaId) ?? producto.tiendas[0];
  if (!tienda) return [{ tipo: "aviso", aviso: "sin_tienda" }];

  const frases: FraseVoz[] = [{ tipo: "precio", monto: tienda.price, moneda: tienda.currency }];
  const disponible = tienda.stock - tienda.reserved;
  if (disponible <= 0) {
    frases.push({ tipo: "aviso", aviso: tienda.sellWithoutStock ? "a_pedido" : "agotado" });
  } else if (disponible <= 5 && Number.isInteger(disponible) && producto.inventoryType !== "fractional") {
    frases.push({ tipo: "aviso", aviso: "quedan", n: disponible });
  }
  return frases;
}

/** Lo que dice la voz al cargarlo en la venta (Caja): el precio y cuántos van. */
export function frasesAlAgregar(resultado: ResultadoAgregar): FraseVoz[] {
  if (resultado.ok === false) {
    return [{ tipo: "aviso", aviso: resultado.motivo }];
  }
  const frases: FraseVoz[] = [{ tipo: "precio", monto: resultado.tienda.price, moneda: resultado.tienda.currency }];
  if (resultado.cantidad >= 2 && resultado.cantidad <= 20) frases.push({ tipo: "aviso", aviso: "van", n: resultado.cantidad });
  return frases;
}
