import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { OrderStatus, type Order } from "@/entities/order/model/types";

/**
 * Armar un pedido escaneando: cada lectura tilda una unidad de lo que lleva
 * el pedido. Avisa si lo escaneado no es del pedido o si ya están todas.
 *
 * Lo tildado se guarda en el navegador: cerrar el pedido o recargar no hace
 * perder lo que ya se armó. No cambia el pedido: moverlo de estado sigue
 * siendo una decisión del comerciante (puede mandarle un WhatsApp al cliente).
 */

export interface LineaArmado {
  itemId: string;
  productId: string;
  nombre: string;
  imagen: string | null;
  /** Cuántas cosas lleva la línea: 3 camisas, 2 decants. */
  lleva: number;
}

export type ResultadoTilde =
  | { tipo: "sumado"; linea: LineaArmado; cuenta: number; pedidoCompleto: boolean }
  | { tipo: "ya_estan"; linea: LineaArmado }
  | { tipo: "no_esta" };

/** Solo se arma lo que todavía no salió. */
export function esArmable(order: Pick<Order, "status"> | null | undefined): boolean {
  return order?.status === OrderStatus.PENDIENTE || order?.status === OrderStatus.EN_PROCESO;
}

export function lineasArmado(order: Pick<Order, "items"> | null | undefined): LineaArmado[] {
  return (order?.items ?? [])
    .filter((i) => i.id && i.storeProduct?.product?.id && i.quantity > 0)
    .map((i) => ({
      itemId: i.id,
      productId: i.storeProduct!.product!.id,
      nombre: i.storeProduct!.product!.name,
      imagen: i.storeProduct!.product!.imageUrls?.[0] ?? null,
      lleva: i.quantity,
    }));
}

/**
 * Tilda una unidad del producto: la primera línea suya que no está completa.
 * Puro, para poder probarlo sin el componente.
 */
export function tildar(
  lineas: LineaArmado[],
  armado: Record<string, number>,
  productId: string,
): { armado: Record<string, number>; resultado: ResultadoTilde } {
  const suyas = lineas.filter((l) => l.productId === productId);
  if (suyas.length === 0) return { armado, resultado: { tipo: "no_esta" } };
  const linea = suyas.find((l) => (armado[l.itemId] ?? 0) < l.lleva);
  if (!linea) return { armado, resultado: { tipo: "ya_estan", linea: suyas[0] } };
  const cuenta = (armado[linea.itemId] ?? 0) + 1;
  const nuevo = { ...armado, [linea.itemId]: cuenta };
  return {
    armado: nuevo,
    resultado: {
      tipo: "sumado",
      linea,
      cuenta,
      pedidoCompleto: lineas.every((l) => (nuevo[l.itemId] ?? 0) >= l.lleva),
    },
  };
}

const clave = (orderId: string) => `vendfy.armado.${orderId}`;

function leer(orderId: string | undefined): Record<string, number> {
  if (!orderId) return {};
  try {
    const crudo = localStorage.getItem(clave(orderId));
    return crudo ? (JSON.parse(crudo) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function guardar(orderId: string, armado: Record<string, number>) {
  try {
    if (Object.values(armado).some((n) => n > 0)) {
      localStorage.setItem(clave(orderId), JSON.stringify(armado));
    } else {
      localStorage.removeItem(clave(orderId));
    }
  } catch {
    // Sin almacenamiento, lo tildado vive mientras el pedido esté abierto.
  }
}

export function useArmado(order: Order | null | undefined) {
  const orderId = order?.id;
  // Lo tildado va atado al pedido del que se leyó: así nunca se guarda lo de
  // un pedido con la clave de otro.
  const [cargado, setCargado] = useState(() => ({ id: orderId, armado: leer(orderId) }));
  if (cargado.id !== orderId) setCargado({ id: orderId, armado: leer(orderId) });
  const armado = cargado.armado;

  // La pistola puede leer dos veces antes de que se vuelva a pintar: se tilda
  // sobre lo último, no sobre lo que había en el render anterior.
  const ultimo = useRef(armado);
  ultimo.current = armado;

  useEffect(() => {
    if (cargado.id) guardar(cargado.id, cargado.armado);
  }, [cargado]);

  const lineas = useMemo(() => lineasArmado(order), [order]);

  const escanear = useCallback(
    (productId: string): ResultadoTilde => {
      const { armado: nuevo, resultado } = tildar(lineas, ultimo.current, productId);
      if (resultado.tipo === "sumado") {
        ultimo.current = nuevo;
        setCargado((c) => ({ ...c, armado: nuevo }));
      }
      return resultado;
    },
    [lineas],
  );

  /** A mano: tocar la línea la completa o la vacía. */
  const alternar = useCallback((linea: LineaArmado) => {
    setCargado((c) => ({
      ...c,
      armado: {
        ...c.armado,
        [linea.itemId]: (c.armado[linea.itemId] ?? 0) >= linea.lleva ? 0 : linea.lleva,
      },
    }));
  }, []);

  const reiniciar = useCallback(() => setCargado((c) => ({ ...c, armado: {} })), []);

  const total = lineas.reduce((s, l) => s + l.lleva, 0);
  const listas = lineas.reduce((s, l) => s + Math.min(l.lleva, armado[l.itemId] ?? 0), 0);

  return {
    armado,
    lineas,
    total,
    listas,
    empezo: listas > 0,
    completo: total > 0 && listas >= total,
    escanear,
    alternar,
    reiniciar,
  };
}
