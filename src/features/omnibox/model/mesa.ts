import type { CostoProducto, ItemPedido, ProductoOpcion } from "@/entities/omnibox/model/types";

/**
 * La mesa de trabajo: lo que se construye a la derecha del chat.
 *
 * Es un ESTADO, no una página. El chat y el panel la modifican con las mismas
 * acciones, así que tocar "+" en el carrito y decir "que sean 3" terminan en el
 * mismo lugar. Por eso vive en un reductor puro, sin React: se prueba sin
 * navegador y no hay dos caminos que puedan divergir.
 *
 * Reglas (ver ASISTENTE-PANEL.md, 3.1):
 * - Una mesa abierta a la vez.
 * - Cerrar o cambiar de mesa NO borra su borrador. Perder un carrito armado
 *   por ir a ver otra cosa es lo que hace desconfiar de toda la pantalla.
 * - La ficha de producto no es una mesa: es una pestaña de la venta o de la
 *   compra, porque un producto se mira PARA agregarlo a algo.
 */

export type TipoMesa = "venta" | "compra";

export type Pestana = "producto" | "borrador";

export type MetodoPago = "efectivo" | "qr" | "tarjeta";

export interface LineaVenta {
  productId: string;
  storeProductId: string;
  nombre: string;
  imagen: string | null;
  /** Precio unitario de ESTA venta. Arranca en el de lista y se puede cambiar. */
  precio: number;
  cantidad: number;
  /** Stock de la tienda al momento de agregarlo: para avisar si no alcanza. */
  stock: number;
}

export interface LineaCompra {
  productId: string;
  storeProductId: string;
  nombre: string;
  imagen: string | null;
  cantidad: number;
  /** Costo unitario que se pagó al proveedor. */
  costo: number;
  /** Lo que se pagó la vez anterior: si el proveedor subió, se nota. */
  costoAnterior: number | null;
}

export interface BorradorVenta {
  lineas: LineaVenta[];
  /** null = consumidor final. */
  clienteId: string | null;
  clienteNombre: string;
  /**
   * null = todavía no se eligió. Arranca así a propósito (G0): registrar el
   * método equivocado descuadra la caja, y "efectivo" por defecto lo hacía
   * pasar desapercibido. Al cobrar sin método, la Guía lo pide.
   */
  pago: MetodoPago | null;
}

export interface BorradorCompra {
  lineas: LineaCompra[];
  proveedor: string;
  /** Teléfono o contacto del proveedor. Opcional. */
  contacto: string;
  /** Número de factura o remito. */
  referencia: string;
  /** La foto de la factura ya subida, si la compra salió de una foto. */
  adjunto: string | null;
  /**
   * Los renglones de la factura que todavía no se resolvieron (dudosos o
   * nuevos), como `mensajeId:indice`. Mientras haya alguno, la compra no se
   * registra: quedaría una compra con productos de menos.
   */
  porResolver: string[];
}

export interface Mesa {
  abierta: TipoMesa | null;
  pestana: Pestana;
  /** El producto en la pestaña "Producto". */
  producto: ProductoOpcion | null;
  /** El panel ocupa todo el ancho y el chat se esconde. */
  ampliada: boolean;
  venta: BorradorVenta;
  compra: BorradorCompra;
  /**
   * La última mesa con la que se trabajó. En el teléfono el panel no se abre
   * con cada frase, así que "que sean 3" necesita saber de cuál se hablaba.
   */
  ultima: TipoMesa;
}

export const VENTA_VACIA: BorradorVenta = {
  lineas: [],
  clienteId: null,
  clienteNombre: "Consumidor final",
  pago: null,
};

export const COMPRA_VACIA: BorradorCompra = {
  lineas: [],
  proveedor: "",
  contacto: "",
  referencia: "",
  adjunto: null,
  porResolver: [],
};

export const MESA_INICIAL: Mesa = {
  abierta: null,
  pestana: "producto",
  producto: null,
  ampliada: false,
  venta: VENTA_VACIA,
  compra: COMPRA_VACIA,
  ultima: "venta",
};

export type AccionMesa =
  | { tipo: "abrir"; mesa: TipoMesa; pestana?: Pestana }
  | { tipo: "cerrar" }
  | { tipo: "pestana"; pestana: Pestana }
  | { tipo: "ampliar"; valor?: boolean }
  /**
   * Mostrar un producto. Si hay una mesa abierta se muestra ahí (en una compra
   * se mira para comprarlo); si no, abre la venta, que es lo más común.
   */
  | { tipo: "verProducto"; producto: ProductoOpcion }
  // ---- venta
  | { tipo: "agregarVenta"; producto: ProductoOpcion; cantidad?: number; precio?: number }
  | { tipo: "quitarVenta"; productId: string }
  | { tipo: "cantidadVenta"; productId: string; cantidad: number }
  | { tipo: "precioVenta"; productId: string; precio: number }
  | { tipo: "cliente"; clienteId: string | null; nombre: string }
  | { tipo: "pago"; pago: MetodoPago }
  | { tipo: "limpiarVenta" }
  // ---- compra
  | { tipo: "agregarCompra"; producto: ProductoOpcion; cantidad?: number; costo: number; costoAnterior: number | null }
  | { tipo: "quitarCompra"; productId: string }
  | { tipo: "cantidadCompra"; productId: string; cantidad: number }
  | { tipo: "costoCompra"; productId: string; costo: number }
  | { tipo: "proveedor"; proveedor: string; contacto?: string }
  | { tipo: "referencia"; referencia: string }
  /** Se leyó una factura: su foto, su proveedor y los renglones por resolver. */
  | {
      tipo: "factura";
      adjunto: string | null;
      porResolver: string[];
      proveedor?: string | null;
      referencia?: string | null;
    }
  /** Un renglón de la factura se eligió, se creó o se descartó. */
  | { tipo: "lineaResuelta"; clave: string }
  | { tipo: "limpiarCompra" };

export function mesaReducer(m: Mesa, a: AccionMesa): Mesa {
  switch (a.tipo) {
    case "abrir":
      return {
        ...m,
        abierta: a.mesa,
        ultima: a.mesa,
        // Al abrir una mesa con algo armado, lo primero que interesa es eso;
        // si está vacía, no hay nada que ver más que el producto.
        pestana: a.pestana ?? (borradorDe(m, a.mesa).lineas.length > 0 ? "borrador" : "producto"),
      };

    case "cerrar":
      return { ...m, abierta: null, ampliada: false };

    case "pestana":
      return { ...m, pestana: a.pestana };

    case "ampliar":
      return { ...m, ampliada: a.valor ?? !m.ampliada };

    case "verProducto":
      return { ...m, abierta: m.abierta ?? "venta", pestana: "producto", producto: a.producto };

    case "agregarVenta": {
      const cantidad = Math.max(1, Math.floor(a.cantidad ?? 1));
      const existente = m.venta.lineas.find((l) => l.productId === a.producto.productId);
      // Agregar lo que ya está suma: "agregá otro" no debe duplicar la línea.
      const lineas = existente
        ? m.venta.lineas.map((l) =>
            l.productId === a.producto.productId
              ? { ...l, cantidad: l.cantidad + cantidad, precio: a.precio ?? l.precio }
              : l,
          )
        : [
            ...m.venta.lineas,
            {
              productId: a.producto.productId,
              storeProductId: a.producto.storeProductId,
              nombre: a.producto.nombre,
              imagen: a.producto.imagen,
              precio: a.precio ?? Number(a.producto.precio),
              cantidad,
              stock: Number(a.producto.stock),
            },
          ];
      // No abre el panel: quien agrega desde el chat en el teléfono no quiere
      // que la hoja le tape la conversación en cada "sumá". Abrirlo lo decide
      // la pantalla (en escritorio sí, en el teléfono queda el chip).
      return { ...m, ultima: "venta", venta: { ...m.venta, lineas } };
    }

    case "quitarVenta":
      return {
        ...m,
        venta: { ...m.venta, lineas: m.venta.lineas.filter((l) => l.productId !== a.productId) },
      };

    case "cantidadVenta":
      // Cantidad 0 o menos es quitarla: el "−" en 1 no deja una línea en cero.
      if (a.cantidad <= 0) return mesaReducer(m, { tipo: "quitarVenta", productId: a.productId });
      return {
        ...m,
        venta: {
          ...m.venta,
          lineas: m.venta.lineas.map((l) =>
            l.productId === a.productId ? { ...l, cantidad: Math.floor(a.cantidad) } : l,
          ),
        },
      };

    case "precioVenta":
      if (!(a.precio >= 0)) return m;
      return {
        ...m,
        venta: {
          ...m.venta,
          lineas: m.venta.lineas.map((l) => (l.productId === a.productId ? { ...l, precio: a.precio } : l)),
        },
      };

    case "cliente":
      return { ...m, venta: { ...m.venta, clienteId: a.clienteId, clienteNombre: a.nombre } };

    case "pago":
      return { ...m, venta: { ...m.venta, pago: a.pago } };

    case "limpiarVenta":
      return { ...m, venta: VENTA_VACIA };

    // ---------------------------------------------------------- compra
    case "agregarCompra": {
      const cantidad = Math.max(1, Math.floor(a.cantidad ?? 1));
      const existente = m.compra.lineas.find((l) => l.productId === a.producto.productId);
      const lineas = existente
        ? m.compra.lineas.map((l) =>
            l.productId === a.producto.productId ? { ...l, cantidad: l.cantidad + cantidad, costo: a.costo } : l,
          )
        : [
            ...m.compra.lineas,
            {
              productId: a.producto.productId,
              storeProductId: a.producto.storeProductId,
              nombre: a.producto.nombre,
              imagen: a.producto.imagen,
              cantidad,
              costo: a.costo,
              costoAnterior: a.costoAnterior,
            },
          ];
      return { ...m, ultima: "compra", compra: { ...m.compra, lineas } };
    }
    case "quitarCompra":
      return {
        ...m,
        compra: { ...m.compra, lineas: m.compra.lineas.filter((l) => l.productId !== a.productId) },
      };
    case "cantidadCompra":
      if (a.cantidad <= 0) return mesaReducer(m, { tipo: "quitarCompra", productId: a.productId });
      return {
        ...m,
        compra: {
          ...m.compra,
          lineas: m.compra.lineas.map((l) =>
            l.productId === a.productId ? { ...l, cantidad: Math.floor(a.cantidad) } : l,
          ),
        },
      };
    case "costoCompra":
      if (!(a.costo >= 0)) return m;
      return {
        ...m,
        compra: {
          ...m.compra,
          lineas: m.compra.lineas.map((l) => (l.productId === a.productId ? { ...l, costo: a.costo } : l)),
        },
      };
    case "proveedor":
      return {
        ...m,
        compra: { ...m.compra, proveedor: a.proveedor, contacto: a.contacto ?? m.compra.contacto },
      };
    case "referencia":
      return { ...m, compra: { ...m.compra, referencia: a.referencia } };
    case "factura":
      return {
        ...m,
        ultima: "compra",
        compra: {
          ...m.compra,
          adjunto: a.adjunto ?? m.compra.adjunto,
          porResolver: [...new Set([...m.compra.porResolver, ...a.porResolver])],
          proveedor: a.proveedor?.trim() || m.compra.proveedor,
          referencia: a.referencia?.trim() || m.compra.referencia,
        },
      };
    case "lineaResuelta":
      return {
        ...m,
        compra: { ...m.compra, porResolver: m.compra.porResolver.filter((c) => c !== a.clave) },
      };
    case "limpiarCompra":
      return { ...m, compra: COMPRA_VACIA };
  }
}

// ------------------------------------------------------------ lecturas

export function borradorDe(m: Mesa, tipo: TipoMesa): { lineas: unknown[] } {
  return tipo === "venta" ? m.venta : m.compra;
}

export function totalCompra(c: BorradorCompra): number {
  return Math.round(c.lineas.reduce((s, l) => s + l.costo * l.cantidad, 0) * 100) / 100;
}

/** El costo que se precarga: el que se dijo, si no el último, si no el promedio. */
export function costoSugerido(dicho: number | null | undefined, costo: CostoProducto | null | undefined): number {
  return dicho ?? costo?.ultimoCosto ?? costo?.costoPromedio ?? 0;
}

export function totalVenta(v: BorradorVenta): number {
  // Redondeo a centavos al final, no por línea: 3 × 3,33 da 9,99 y no 9,98.
  return Math.round(v.lineas.reduce((s, l) => s + l.precio * l.cantidad, 0) * 100) / 100;
}

export function unidades(lineas: { cantidad: number }[]): number {
  return lineas.reduce((s, l) => s + l.cantidad, 0);
}

/** Líneas que piden más de lo que hay en la tienda. */
export function faltantes(v: BorradorVenta): LineaVenta[] {
  return v.lineas.filter((l) => l.cantidad > l.stock);
}

/**
 * Las mesas con algo armado que NO están a la vista: lo que muestra el chip
 * "Venta en curso · 2" encima del campo, para volver.
 */
export function enCurso(m: Mesa): { tipo: TipoMesa; lineas: number }[] {
  const tipos: TipoMesa[] = ["venta", "compra"];
  return tipos
    .filter((t) => t !== m.abierta && borradorDe(m, t).lineas.length > 0)
    .map((t) => ({ tipo: t, lineas: borradorDe(m, t).lineas.length }));
}

// ------------------------------------------------------------ frases → acciones

/**
 * Una factura leída de una foto, como acción sobre la compra: la foto, el
 * proveedor y los renglones que faltan resolver. Los renglones reconocidos
 * se cargan aparte, con `efectoDeVenta`, igual que "compré 3 cocas".
 */
export function facturaDe(
  mensajeId: string,
  p: { entidades: Record<string, unknown>; items?: ItemPedido[] },
): AccionMesa | null {
  const e = p.entidades as Record<string, any>;
  if (!e.factura) return null;
  return {
    tipo: "factura",
    adjunto: e.adjunto ?? null,
    porResolver: (p.items ?? []).flatMap((it, i) => (it.producto ? [] : [`${mensajeId}:${i}`])),
    proveedor: e.proveedor ?? null,
    referencia: e.referencia ?? null,
  };
}

const NOMBRE_PAGO: Record<MetodoPago, string> = { efectivo: "efectivo", qr: "QR", tarjeta: "tarjeta" };

function bs(n: number): string {
  return `Bs ${n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface EfectoDeVenta {
  /** Lo que se le aplica al reductor: lo mismo que harían los botones. */
  acciones: AccionMesa[];
  /** La línea que queda en el chat: "Agregado a la venta · 2 × Coca Cola 2L". */
  resumen: string;
  imagen?: string | null;
  /** "Cobrá": después de aplicar las acciones, se cobra (D2). */
  cobrar?: boolean;
}

/**
 * Traduce una frase ya entendida por el servidor a acciones sobre la mesa.
 *
 * Es la única puerta entre el chat y el carrito, y es pura: "sumá 2 cocas"
 * termina en el mismo `agregarVenta` que el botón "Agregar a la venta". Si
 * la propuesta no alcanza para actuar (falta el producto, hay dos José),
 * devuelve null y la pantalla muestra la tarjeta para elegir.
 */
export function efectoDeVenta(p: {
  intencion: string | null;
  ejecutable: boolean;
  entidades: Record<string, unknown>;
  producto: ProductoOpcion | null;
  items?: ItemPedido[];
  clienteAplicado?: string;
  costos?: Record<string, CostoProducto>;
}): EfectoDeVenta | null {
  if (!p.ejecutable || !p.intencion) return null;
  const e = p.entidades as Record<string, any>;

  // Cargar a la compra: como un pedido, con el costo de cada renglón (el que
  // se dijo o, si no, el último que se pagó).
  if (p.intencion === "agregar_a_compra" && p.items) {
    const acciones: AccionMesa[] = [];
    const partes: string[] = [];
    for (const it of p.items) {
      if (!it.producto || it.agregados?.includes(it.producto.productId)) continue;
      const previo = p.costos?.[it.producto.productId];
      const costo = costoSugerido(it.precio, previo);
      acciones.push({
        tipo: "agregarCompra",
        producto: it.producto,
        cantidad: it.cantidad,
        costo,
        costoAnterior: previo?.ultimoCosto ?? null,
      });
      partes.push(`${it.cantidad} × ${it.producto.nombre} a ${bs(costo)}`);
    }
    if (acciones.length === 0) return null;
    return { acciones, resumen: `Cargado a la compra · ${partes.join(", ")}` };
  }

  // Un pedido de varias cosas: se agrega lo claro que todavía no se agregó,
  // y el cliente si quedó claro. Lo dudoso queda en la tarjeta para elegir.
  if (p.intencion === "agregar_a_venta" && p.items) {
    const acciones: AccionMesa[] = [];
    const partes: string[] = [];
    for (const it of p.items) {
      if (!it.producto || it.agregados?.includes(it.producto.productId)) continue;
      acciones.push({
        tipo: "agregarVenta",
        producto: it.producto,
        cantidad: it.cantidad,
        ...(it.precio != null ? { precio: it.precio } : {}),
      });
      partes.push(`${it.cantidad} × ${it.producto.nombre}`);
    }
    if (e.clienteId && !p.clienteAplicado) {
      acciones.push({ tipo: "cliente", clienteId: e.clienteId, nombre: e.cliente });
      partes.push(`para ${e.cliente}`);
    }
    if (acciones.length === 0) return null;
    return { acciones, resumen: `Agregado a la venta · ${partes.join(", ")}` };
  }

  switch (p.intencion) {
    case "agregar_a_venta": {
      if (!p.producto) return null;
      const cantidad = Math.max(1, Math.floor(Number(e.cantidad ?? 1)));
      const precio = e.precio != null ? Number(e.precio) : Number(p.producto.precio);
      return {
        acciones: [
          { tipo: "agregarVenta", producto: p.producto, cantidad, ...(e.precio != null ? { precio } : {}) },
        ],
        resumen: `Agregado a la venta · ${cantidad} × ${p.producto.nombre} · ${bs(precio * cantidad)}`,
        imagen: p.producto.imagen,
      };
    }
    // "Sacá" y "que sean N" actúan sobre la mesa que dijo el servidor.
    case "quitar_de_venta": {
      if (!e.productId) return null;
      const compra = e.mesa === "compra";
      return {
        acciones: [{ tipo: compra ? "quitarCompra" : "quitarVenta", productId: e.productId }],
        resumen: `Saqué ${e.producto} de la ${compra ? "compra" : "venta"}`,
      };
    }
    case "cambiar_cantidad_venta": {
      if (!e.productId || e.cantidad == null) return null;
      const cantidad = Math.floor(Number(e.cantidad));
      const compra = e.mesa === "compra";
      return {
        acciones: [{ tipo: compra ? "cantidadCompra" : "cantidadVenta", productId: e.productId, cantidad }],
        resumen:
          cantidad <= 0
            ? `Saqué ${e.producto} de la ${compra ? "compra" : "venta"}`
            : `${e.producto}: ahora son ${cantidad}`,
      };
    }
    case "cambiar_costo_compra":
      if (!e.productId || e.costo == null) return null;
      return {
        acciones: [{ tipo: "costoCompra", productId: e.productId, costo: Number(e.costo) }],
        resumen: `${e.producto}: costo ${bs(Number(e.costo))}`,
      };
    case "elegir_proveedor":
      if (!e.proveedor) return null;
      return {
        acciones: [{ tipo: "proveedor", proveedor: String(e.proveedor) }],
        resumen: `La compra es de ${e.proveedor}`,
      };
    case "elegir_cliente":
      if (!e.clienteId) return null;
      return {
        acciones: [{ tipo: "cliente", clienteId: e.clienteId, nombre: e.cliente }],
        resumen: `La venta es para ${e.cliente}`,
      };
    case "elegir_pago":
      if (!e.pago) return null;
      return {
        acciones: [{ tipo: "pago", pago: e.pago as MetodoPago }],
        resumen: `Paga con ${NOMBRE_PAGO[e.pago as MetodoPago]}`,
      };
    case "vaciar_venta":
      return e.mesa === "compra"
        ? { acciones: [{ tipo: "limpiarCompra" }], resumen: "Empecé la compra de nuevo" }
        : { acciones: [{ tipo: "limpiarVenta" }], resumen: "Empecé la venta de nuevo" };
    case "cobrar":
      return {
        acciones: e.pago ? [{ tipo: "pago", pago: e.pago as MetodoPago }] : [],
        resumen: "Cobrando…",
        cobrar: true,
      };
    default:
      return null;
  }
}

/**
 * Marca en la propuesta lo que ya se aplicó, para que la tarjeta lo muestre
 * con su ✓ y para que volver a aplicar (al elegir el cliente, por ejemplo)
 * no agregue dos veces los mismos productos.
 */
export function marcarAplicados<P extends { items?: ItemPedido[]; entidades: Record<string, unknown>; clienteAplicado?: string }>(
  p: P,
): P {
  const e = p.entidades as Record<string, any>;
  return {
    ...p,
    items: p.items?.map((it) =>
      it.producto && !it.agregados?.includes(it.producto.productId)
        ? { ...it, agregados: [...(it.agregados ?? []), it.producto.productId] }
        : it,
    ),
    clienteAplicado: e.clienteId ? e.cliente : p.clienteAplicado,
  };
}
