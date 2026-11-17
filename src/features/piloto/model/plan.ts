/**
 * De lo que entendió el servidor a lo que el piloto hace en la pantalla.
 *
 * El servidor ya sabe leer "vende dos coca y una fanta con QR" (es el mismo
 * intérprete del asistente). Acá solo se decide DÓNDE se hace: una venta va a
 * la Caja de verdad, con su carrito, en vez de la mesa del asistente.
 */
import type { Propuesta, ProductoOpcion } from "@/entities/omnibox/model/types";
import { efectoDeVenta } from "@/features/omnibox/model/mesa";

import type { PagoPiloto } from "./respuestas";

export type AccionCaja =
  | { tipo: "agregar"; producto: ProductoOpcion; cantidad: number; precio?: number }
  | { tipo: "quitar"; productId: string; nombre: string }
  | { tipo: "cantidad"; productId: string; nombre: string; cantidad: number }
  | { tipo: "pago"; pago: PagoPiloto; recibidoUsd: number | null }
  | { tipo: "cliente"; clienteId: string; nombre: string }
  | { tipo: "vaciar" };

export type PlanPiloto =
  /** Algo en la Caja: cargar, sacar, cambiar el pago y, si lo pidió, cobrar. */
  | { tipo: "caja"; acciones: AccionCaja[]; cobrar: boolean }
  /** Una respuesta que se dice y se muestra (el dólar, cuánto vendió…). */
  | { tipo: "decir"; texto: string }
  /** Se entendió, pero desde aquí todavía no se hace: va al asistente. */
  | { tipo: "asistente"; texto: string };

/** Lo que la Caja todavía no hace por voz: se arma en el asistente. */
const SOLO_ASISTENTE = "Eso todavía no lo hago desde aquí. Te lo dejo abierto en el asistente.";

export function planDe(p: Propuesta): PlanPiloto {
  if (p.bloqueo === "sin-permiso") return { tipo: "decir", texto: "Tu usuario no tiene permiso para eso." };

  // El agente (C4) contesta con un texto y tarjetas: las de la venta se hacen
  // en la Caja; si alguna es de otra cosa (crear un producto…), al asistente.
  if (p.agente) {
    const planes = p.agente.acciones.map(planDe);
    const caja = planes.flatMap((x) => (x.tipo === "caja" ? [x] : []));
    if (caja.length) return { tipo: "caja", acciones: caja.flatMap((x) => x.acciones), cobrar: caja.some((x) => x.cobrar) };
    const texto = p.agente.texto || SOLO_ASISTENTE;
    return planes.some((x) => x.tipo === "asistente") ? { tipo: "asistente", texto } : { tipo: "decir", texto };
  }

  const efecto = efectoDeVenta(p);
  if (efecto) {
    const e = p.entidades as Record<string, any>;
    // Delivery y cuotas piden dirección, fechas y montos: por ahora, en el asistente.
    if (e.entrega?.direccion || e.cuotas?.cantidad) return { tipo: "asistente", texto: SOLO_ASISTENTE };
    if (e.mesa === "compra") return { tipo: "asistente", texto: SOLO_ASISTENTE };

    const acciones: AccionCaja[] = [];
    for (const a of efecto.acciones) {
      switch (a.tipo) {
        case "agregarVenta":
          acciones.push({ tipo: "agregar", producto: a.producto, cantidad: a.cantidad, ...(a.precio != null ? { precio: a.precio } : {}) });
          break;
        case "quitarVenta":
          acciones.push({ tipo: "quitar", productId: a.productId, nombre: String(e.producto ?? "") });
          break;
        case "cantidadVenta":
          acciones.push({ tipo: "cantidad", productId: a.productId, nombre: String(e.producto ?? ""), cantidad: a.cantidad });
          break;
        case "pago":
          acciones.push({ tipo: "pago", pago: a.pago, recibidoUsd: a.recibidoUsd ?? null });
          break;
        case "cliente":
          acciones.push({ tipo: "cliente", clienteId: a.clienteId, nombre: a.nombre });
          break;
        case "limpiarVenta":
          acciones.push({ tipo: "vaciar" });
          break;
        default:
          break;
      }
    }
    const cobrar = Boolean(efecto.cobrar);
    if (acciones.length || cobrar) return { tipo: "caja", acciones, cobrar };
  }

  // Un pedido de varias cosas donde nada quedó claro.
  if (p.intencion === "agregar_a_venta" && p.items?.length) {
    const dudas = p.items.filter((it) => !it.producto);
    const nombres = dudas.map((it) => it.noEncontrado ?? it.buscado).filter(Boolean);
    if (dudas.some((it) => it.opciones.length > 1)) {
      return { tipo: "decir", texto: `Hay varios parecidos a ${nombres.join(" y ")}. Dime cuál, con el nombre completo.` };
    }
    return { tipo: "decir", texto: `No encontré ${nombres.join(" ni ")} en tus productos.` };
  }
  if (p.intencion === "agregar_a_venta" && !p.producto) {
    if (p.opciones.length > 1) {
      const nombres = p.opciones.slice(0, 3).map((o) => o.nombre);
      return { tipo: "decir", texto: `¿Cuál? Tengo ${nombres.join(", ")}.` };
    }
    if (p.noEncontrado) return { tipo: "decir", texto: `No encontré ${p.noEncontrado} en tus productos.` };
  }

  // Consultas que el servidor ya contestó (el dólar, cuánto vendió…).
  if (p.resultado?.resumen) return { tipo: "decir", texto: p.resultado.resumen };
  if (p.aviso && !p.intencion) return { tipo: "decir", texto: p.aviso };
  if (!p.intencion) return { tipo: "decir", texto: "No te entendí. ¿Me lo repites con otras palabras?" };
  return { tipo: "asistente", texto: SOLO_ASISTENTE };
}

/** "dos Coca Cola 2L y una Fanta": lo que se agregó, para decirlo y mostrarlo. */
export function resumenAgregado(acciones: AccionCaja[]): string | null {
  const partes = acciones.flatMap((a) => (a.tipo === "agregar" ? [`${a.cantidad} ${a.producto.nombre}`] : []));
  if (!partes.length) return null;
  return partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}
