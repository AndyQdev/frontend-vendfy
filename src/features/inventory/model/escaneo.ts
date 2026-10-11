import type { Inventory } from "@/entities/inventory/model/types";
import type { ResultadoEscaneo } from "@/entities/product/model/escaneo";

/**
 * El producto escaneado como filas de inventario (una por tienda), para abrir
 * el ajuste de stock sin ir a buscarlo a la tabla: con una tienda elegida, la
 * de esa tienda; con "Todas", todas las que tienen stock cargado.
 *
 * Una tienda sin fila de inventario no aparece: no hay dónde anotar un
 * movimiento.
 */
export function inventariosDeEscaneo(r: ResultadoEscaneo, storeId: string): Inventory[] {
  const p = r.producto;
  if (!p) return [];
  return p.tiendas
    .filter((t) => t.inventoryId && (storeId === "all" || t.storeId === storeId))
    .map((t) => ({
      id: t.inventoryId!,
      stockQuantity: Number(t.stock),
      reservedQuantity: Number(t.reserved),
      status: t.stock > 0 ? "disponible" : "agotado",
      product: {
        id: p.id,
        name: p.name,
        sku: p.sku ?? "",
        imageUrls: p.imageUrls,
        price: Number(t.price),
        inventoryType: p.inventoryType,
        contentPerUnit: p.contentPerUnit,
        baseUnit: p.baseUnit ? { id: "", ...p.baseUnit } : undefined,
      },
      store: { id: t.storeId, name: t.storeName },
      createdAt: "",
      updatedAt: "",
    }));
}
