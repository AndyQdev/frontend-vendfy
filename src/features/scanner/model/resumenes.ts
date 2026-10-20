import type { ResumenVentasProducto } from "@/entities/order/model/types";
import type { ResumenComprasProducto } from "@/entities/purchase-order/model/types";
import { formatMoney } from "@/shared/lib/money";

import { haceCuanto } from "./useFiltroEscaneado";

/**
 * Lo que dice el encabezado de una lista filtrada por lo escaneado, en una
 * línea. Es lo que se viene a preguntar: ¿se vende? ¿a cuánto lo compré?
 */

const cantidad = (n: number) => n.toLocaleString("es-BO", { maximumFractionDigits: 2 });

/**
 * "34 vendidas en 20 ventas · Bs 408,00 · la última hace 2 días". En
 * Pedidos va con el período del tablero y dice "pedidos".
 */
export function textoVentas(
  r: ResumenVentasProducto | undefined,
  periodo?: string,
  cada: "venta" | "pedido" = "venta",
  /** Cuántas hay en la lista: si hay y no cuentan como vendidas, se dice por qué. */
  enLista = 0,
): string | undefined {
  if (!r) return undefined;
  const prefijo = periodo ? `${periodo}: ` : "";
  if (r.ventas === 0) {
    const porQue = enLista > 0 ? ` Las de abajo están canceladas o sin confirmar.` : "";
    return `${prefijo}${periodo ? "no" : "Todavía no"} se vendió.${porQue}`;
  }
  const ultima = haceCuanto(r.ultima);
  return (
    `${prefijo}${cantidad(r.unidades)} ${r.unidades === 1 ? "vendida" : "vendidas"} ` +
    `en ${r.ventas} ${cada}${r.ventas === 1 ? "" : "s"} · ${formatMoney(r.monto)}` +
    (ultima ? ` · ${cada === "venta" ? "la última" : "el último"} ${ultima}` : "")
  );
}

/** "Compraste 120 en 8 compras · la última a Bs 10,50 (Distribuidora Andina), hace 12 días". */
export function textoCompras(r: ResumenComprasProducto | undefined): string | undefined {
  if (!r) return undefined;
  if (r.compras === 0) return "Todavía no lo compraste.";
  const ultima = haceCuanto(r.ultima);
  const costo = r.ultimoCosto != null ? ` a ${formatMoney(r.ultimoCosto)}` : "";
  const proveedor = r.ultimoProveedor ? ` (${r.ultimoProveedor})` : "";
  return (
    `Compraste ${cantidad(r.unidades)} en ${r.compras} ${r.compras === 1 ? "compra" : "compras"} · ` +
    `la última${costo}${proveedor}${ultima ? `, ${ultima}` : ""}`
  );
}
