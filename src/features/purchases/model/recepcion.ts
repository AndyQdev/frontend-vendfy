import { useCallback, useEffect, useMemo, useState } from "react";

import type { PurchaseOrder } from "@/entities/purchase-order/model/types";

/**
 * Recibir una compra escaneando: cada lectura cuenta una unidad de lo que
 * llegó. Al confirmar, lo contado manda sobre lo pedido (lo que faltó sale de
 * la compra, lo que sobró o no estaba pedido entra).
 *
 * El conteo se guarda en el navegador mientras dura: recargar la página o ir
 * a otra pantalla no hace perder lo que ya se escaneó.
 */

/** Algo que llegó sin estar en la compra. */
export interface ExtraRecibido {
  productId: string;
  nombre: string;
  imagen: string | null;
  cantidad: number;
  /** Lo último que se pagó, si se sabe; se puede corregir. */
  costo: number;
}

export interface Recepcion {
  /** Por producto de la compra, cuántos llegaron. */
  llego: Record<string, number>;
  extras: ExtraRecibido[];
}

export interface LineaPedida {
  productId: string;
  nombre: string;
  pedido: number;
}

export interface Diferencias {
  faltan: { nombre: string; faltan: number; de: number }[];
  deMas: { nombre: string; cantidad: number }[];
  sinPedir: { nombre: string; cantidad: number }[];
}

const VACIA: Recepcion = { llego: {}, extras: [] };
const clave = (poId: string) => `vendfy.recepcion.${poId}`;

function leer(poId: string | undefined): Recepcion {
  if (!poId) return VACIA;
  try {
    const crudo = localStorage.getItem(clave(poId));
    if (!crudo) return VACIA;
    const r = JSON.parse(crudo) as Partial<Recepcion>;
    return { llego: r.llego ?? {}, extras: Array.isArray(r.extras) ? r.extras : [] };
  } catch {
    return VACIA;
  }
}

function guardar(poId: string, r: Recepcion) {
  try {
    if (Object.keys(r.llego).length === 0 && r.extras.length === 0) {
      localStorage.removeItem(clave(poId));
    } else {
      localStorage.setItem(clave(poId), JSON.stringify(r));
    }
  } catch {
    // Sin almacenamiento el conteo vive mientras la página esté abierta.
  }
}

/** Lo pedido por producto: si un producto está en dos líneas, se suma. */
export function lineasPedidas(po: Pick<PurchaseOrder, "items"> | undefined): LineaPedida[] {
  const porProducto = new Map<string, LineaPedida>();
  for (const item of po?.items ?? []) {
    const id = item.product?.id;
    if (!id) continue;
    const previa = porProducto.get(id);
    porProducto.set(id, {
      productId: id,
      nombre: item.product.name,
      pedido: (previa?.pedido ?? 0) + item.quantity,
    });
  }
  return [...porProducto.values()];
}

export function diferencias(lineas: LineaPedida[], r: Recepcion): Diferencias {
  const d: Diferencias = { faltan: [], deMas: [], sinPedir: [] };
  for (const l of lineas) {
    const llego = r.llego[l.productId] ?? 0;
    if (llego < l.pedido) d.faltan.push({ nombre: l.nombre, faltan: l.pedido - llego, de: l.pedido });
    if (llego > l.pedido) d.deMas.push({ nombre: l.nombre, cantidad: llego - l.pedido });
  }
  for (const e of r.extras) {
    if (e.cantidad > 0) d.sinPedir.push({ nombre: e.nombre, cantidad: e.cantidad });
  }
  return d;
}

/** Lo que se manda al confirmar: todas las líneas pedidas (0 si no llegó) y lo que no estaba. */
export function itemsRecibidos(lineas: LineaPedida[], r: Recepcion) {
  return [
    ...lineas.map((l) => ({ productId: l.productId, quantity: r.llego[l.productId] ?? 0 })),
    ...r.extras
      .filter((e) => e.cantidad > 0)
      .map((e) => ({ productId: e.productId, quantity: e.cantidad, unitCost: e.costo })),
  ];
}

export function useRecepcion(po: PurchaseOrder | undefined) {
  const poId = po?.id;
  // El conteo va atado a la compra de la que se leyó: así nunca se guarda el
  // de una compra con la clave de otra.
  const [cargado, setCargado] = useState(() => ({ id: poId, r: leer(poId) }));
  // Contar a mano (sin pistola) también empieza el conteo.
  const [contando, setContando] = useState(false);
  if (cargado.id !== poId) {
    setCargado({ id: poId, r: leer(poId) });
    setContando(false);
  }
  const estado = cargado.r;
  const setEstado = useCallback(
    (cambio: (r: Recepcion) => Recepcion) => setCargado((c) => ({ ...c, r: cambio(c.r) })),
    [],
  );

  useEffect(() => {
    if (cargado.id) guardar(cargado.id, cargado.r);
  }, [cargado]);

  const lineas = useMemo(() => lineasPedidas(po), [po]);

  /** Suma (o resta) a lo que llegó de un producto de la compra. */
  const sumar = useCallback((productId: string, delta: number) => {
    setEstado((e) => ({
      ...e,
      llego: { ...e.llego, [productId]: Math.max(0, (e.llego[productId] ?? 0) + delta) },
    }));
  }, [setEstado]);

  const sumarExtra = useCallback(
    (extra: Omit<ExtraRecibido, "cantidad" | "costo">, cantidad = 1) => {
      setEstado((e) => {
        const ya = e.extras.find((x) => x.productId === extra.productId);
        return {
          ...e,
          extras: ya
            ? e.extras.map((x) =>
                x.productId === extra.productId ? { ...x, cantidad: x.cantidad + cantidad } : x,
              )
            : [...e.extras, { ...extra, cantidad, costo: 0 }],
        };
      });
    },
    [setEstado],
  );

  const cambiarExtra = useCallback((productId: string, cambio: Partial<ExtraRecibido>) => {
    setEstado((e) => ({
      ...e,
      extras: e.extras
        .map((x) => (x.productId === productId ? { ...x, ...cambio } : x))
        .filter((x) => x.cantidad > 0),
    }));
  }, [setEstado]);

  const reiniciar = useCallback(() => {
    setEstado(() => VACIA);
    setContando(false);
  }, [setEstado]);

  const empezo =
    contando ||
    Object.values(estado.llego).some((n) => n > 0) ||
    estado.extras.length > 0;
  const pedidas = lineas.reduce((s, l) => s + l.pedido, 0);
  const llegaron =
    lineas.reduce((s, l) => s + (estado.llego[l.productId] ?? 0), 0) +
    estado.extras.reduce((s, x) => s + x.cantidad, 0);
  const dif = useMemo(() => diferencias(lineas, estado), [lineas, estado]);
  const igualAlPedido =
    dif.faltan.length === 0 && dif.deMas.length === 0 && dif.sinPedir.length === 0;

  return {
    estado,
    lineas,
    empezo,
    pedidas,
    llegaron,
    diferencias: dif,
    igualAlPedido,
    sumar,
    sumarExtra,
    cambiarExtra,
    reiniciar,
    empezarAMano: () => setContando(true),
    items: () => itemsRecibidos(lineas, estado),
  };
}
