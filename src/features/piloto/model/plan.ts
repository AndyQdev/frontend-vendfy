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

/** Un producto cuyo stock se corrige: lo que hay y lo que va a quedar. */
export interface FilaStock {
  productId: string;
  producto: string;
  antes: number | null;
  despues: number;
}

/** El producto nuevo, como lo armó el servidor: lo que falta se pregunta. */
export interface BorradorPiloto {
  nombre: string;
  precio: number | null;
  stock: number | null;
  categoria: { id: string | null; nombre: string } | null;
}

export type PlanPiloto =
  /** Algo en la Caja: cargar, sacar, cambiar el pago y, si lo pidió, cobrar. */
  | { tipo: "caja"; acciones: AccionCaja[]; cobrar: boolean }
  /** Inventario: corregir el stock de uno o de varios (se confirma con "sí"). */
  | { tipo: "stock"; filas: FilaStock[]; entidades: Record<string, unknown> }
  /** Pedidos: mover uno de estado (se confirma con "sí"). */
  | { tipo: "pedido"; orderId: string; numero: number | null; cliente: string | null; antes: string; estado: string }
  /** Productos: llenar el formulario de uno nuevo y guardarlo con "sí". */
  | { tipo: "producto"; borrador: BorradorPiloto }
  /** Una respuesta que se dice y se muestra (el dólar, cuánto vendió…). */
  | { tipo: "decir"; texto: string }
  /** Se entendió, pero desde aquí todavía no se hace: va al asistente. */
  | { tipo: "asistente"; texto: string };

/** Lo que la Caja todavía no hace por voz: se arma en el asistente. */
const SOLO_ASISTENTE = "Te lo dejo listo en el Asistente.";

/** Análisis, gráficas y comparaciones: se arman en el Asistente, con la pregunta ya hecha. */
const A_ANALISIS = "Te lo armo en el Asistente.";

const ORDEN: PlanPiloto["tipo"][] = ["caja", "producto", "stock", "pedido"];

/** Los estados de un pedido como se ven en el tablero. */
export const NOMBRE_ESTADO: Record<string, string> = {
  "por-confirmar": "Por confirmar",
  pendiente: "Pendiente",
  "en-proceso": "En proceso",
  "en-camino": "En camino",
  completado: "Completado",
  cancelado: "Cancelado",
};

export function planDe(p: Propuesta): PlanPiloto {
  if (p.bloqueo === "sin-permiso") return { tipo: "decir", texto: "Tu usuario no tiene permiso para eso." };

  // El agente (C4) contesta con un texto y tarjetas: las que el piloto sabe
  // hacer en su pantalla se hacen ahí; si no, al asistente con su texto.
  if (p.agente) {
    const planes = p.agente.acciones.map(planDe);
    const caja = planes.flatMap((x) => (x.tipo === "caja" ? [x] : []));
    if (caja.length) return { tipo: "caja", acciones: caja.flatMap((x) => x.acciones), cobrar: caja.some((x) => x.cobrar) };
    const hacible = ORDEN.map((t) => planes.find((x) => x.tipo === t)).find(Boolean);
    if (hacible) return hacible;
    const texto = p.agente.texto || SOLO_ASISTENTE;
    // "Para eso hay que ir al asistente": se va, no se dice.
    if (planes.some((x) => x.tipo === "asistente") || /asistente/i.test(texto)) {
      return { tipo: "asistente", texto: /asistente/i.test(texto) ? SOLO_ASISTENTE : texto };
    }
    return { tipo: "decir", texto };
  }

  const e = p.entidades as Record<string, any>;

  // Corregir el stock: uno ("quedan 30 sprite") o varios en una frase.
  if (p.intencion === "ajustar_stock" && p.ejecutable) {
    if (Array.isArray(e.lote) && e.lote.length) {
      const filas: FilaStock[] = e.lote.map((l: any) => ({
        productId: String(l.productId),
        producto: String(l.producto),
        antes: typeof l.antes === "number" ? l.antes : null,
        despues: Number(l.cantidad),
      }));
      return { tipo: "stock", filas, entidades: e };
    }
    if (e.productId && e.cantidad != null) {
      return {
        tipo: "stock",
        filas: [{ productId: String(e.productId), producto: String(e.producto ?? p.producto?.nombre ?? ""), antes: p.vistaPrevia?.antes ?? p.producto?.stock ?? null, despues: Number(p.vistaPrevia?.despues ?? e.cantidad) }],
        entidades: e,
      };
    }
  }
  if (p.intencion === "ajustar_stock" && !p.ejecutable) {
    if (p.opciones.length > 1) return { tipo: "decir", texto: `¿De cuál? Tengo ${p.opciones.slice(0, 3).map((o) => o.nombre).join(", ")}. Dímelo con el nombre completo.` };
    if (p.noEncontrado) return { tipo: "decir", texto: `No encontré ${p.noEncontrado} en tus productos.` };
  }

  // Mover un pedido (lo arma el agente con el número o el cliente).
  if (p.intencion === "estado_pedido" && e.orderId && e.estado) {
    // Cancelar devuelve el stock y avisa al cliente: eso se confirma tocando, no hablando.
    if (e.estado === "cancelado") {
      return { tipo: "asistente", texto: "Cancelar un pedido devuelve el stock: confírmalo tocando en el asistente." };
    }
    return {
      tipo: "pedido",
      orderId: String(e.orderId),
      numero: e.numero ?? null,
      cliente: e.cliente ?? null,
      antes: String(e.antes ?? ""),
      estado: String(e.estado),
    };
  }

  // Un producto nuevo: de a uno en el formulario; varios, en el asistente.
  // «Termina de llenarlo, ponle 50» (completar_formulario) es el mismo formulario.
  if ((p.intencion === "crear_producto" || p.intencion === "completar_formulario") && Array.isArray(e.productos) && e.productos.length === 1) {
    const b = e.productos[0] ?? {};
    return {
      tipo: "producto",
      borrador: {
        nombre: String(b.nombre ?? ""),
        precio: typeof b.precio === "number" && b.precio > 0 ? b.precio : null,
        stock: typeof b.stock === "number" ? b.stock : null,
        categoria: b.categoria?.nombre ? { id: b.categoria.id ?? null, nombre: String(b.categoria.nombre) } : null,
      },
    };
  }

  const efecto = efectoDeVenta(p);
  if (efecto) {
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

  // "¿Cómo vamos este mes?": un análisis con gráficas, en el Asistente.
  if (p.vista || p.intencion === "analizar") return { tipo: "asistente", texto: A_ANALISIS };

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
