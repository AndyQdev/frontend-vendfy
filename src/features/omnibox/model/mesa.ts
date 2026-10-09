import type { ConsultaRecurso, CostoProducto, IdRecurso, ItemPedido, Periodo, ProductoOpcion, VistaSpec } from "@/entities/omnibox/model/types";

import { conPeriodo } from "./vistas";

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

/**
 * Lo que puede estar a la vista en el panel: una de las dos mesas, el
 * análisis (G3) o una herramienta a medida (G6). Esos dos no son mesas: no
 * se arman ni se cobran, se miran (y a lo sumo proponen algo).
 */
export type TipoPanel = TipoMesa | "analisis" | "herramienta" | "lista" | "ficha" | "productos";

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
  /** Stock de la tienda al cargarlo: para mostrar cuánto sube al registrar. */
  stock: number;
}

/** Venta con delivery (G9f): a dónde, cuánto el envío (null = a coordinar) y notas. */
export interface EntregaVenta {
  direccion: string;
  costo: number | null;
  notas: string;
}

/** Venta a cuotas (G9f): en cuántas, cuánto paga hoy y cuándo el próximo pago (AAAA-MM-DD). */
export interface CuotasVenta {
  cantidad: number;
  inicial: number | null;
  proxima: string;
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
  /** G9f: con delivery o a cuotas (como en la Caja). Sin ninguno, en el momento. */
  entrega?: EntregaVenta | null;
  cuotas?: CuotasVenta | null;
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

/** Una pregunta de análisis y la vista que la responde. */
export interface Analisis {
  /** El mensaje del chat que la pidió: su tarjeta dice si está abierta. */
  mensajeId: string;
  pregunta: string;
  vista: VistaSpec;
}

/**
 * La herramienta a la vista (G6). Solo la referencia: la herramienta en sí
 * (código y datos) vive en su mensaje, que es lo que se guarda, una sola vez.
 */
export interface HerramientaAbierta {
  mensajeId: string;
  titulo: string;
}

/**
 * La lista a la vista (G9a): las ventas de septiembre, las compras de un
 * proveedor. Se guarda la CONSULTA (no las filas): sacar un chip u ordenar
 * vuelve a consultar, y una conversación guardada la reabre al día.
 */
export interface ListaAbierta {
  mensajeId: string;
  titulo: string;
  consulta: ConsultaRecurso;
}

/** La ficha a la vista (G9a): una venta, una compra, un cliente, un producto. */
export interface FichaAbierta {
  recurso: IdRecurso;
  id: string;
  titulo: string;
  /** Se abrió tocando una fila de la lista: tiene "Volver a la lista". */
  desdeLista: boolean;
}

export interface Mesa {
  abierta: TipoPanel | null;
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
  /**
   * El último análisis. Como los borradores, cerrar el panel o ir a la venta
   * no lo borra: queda en su pestaña para volver.
   */
  analisis: Analisis | null;
  herramienta: HerramientaAbierta | null;
  lista: ListaAbierta | null;
  ficha: FichaAbierta | null;
  /**
   * El formulario de productos nuevos a la derecha (G9b): se ve cómo se van
   * armando mientras se conversa. Vive en su mensaje; acá, cuál es.
   */
  productos: { mensajeId: string } | null;
}

export const VENTA_VACIA: BorradorVenta = {
  lineas: [],
  clienteId: null,
  clienteNombre: "Consumidor final",
  pago: null,
  entrega: null,
  cuotas: null,
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
  analisis: null,
  herramienta: null,
  lista: null,
  ficha: null,
  productos: null,
};

export type AccionMesa =
  | { tipo: "abrir"; mesa: TipoPanel; pestana?: Pestana }
  /** Mostrar un análisis en el panel (el que se acaba de pedir, o uno anterior del chat). */
  | { tipo: "analizar"; analisis: Analisis }
  /** Mostrar una herramienta a medida en el panel (G6). */
  | { tipo: "usarHerramienta"; herramienta: HerramientaAbierta }
  /** Una lista nueva del chat (G9a), o la misma con otros filtros u orden (los chips). */
  | { tipo: "abrirLista"; lista: ListaAbierta }
  | { tipo: "consultaLista"; consulta: ConsultaRecurso }
  | { tipo: "abrirFicha"; ficha: FichaAbierta }
  | { tipo: "volverALista" }
  | { tipo: "abrirProductos"; mensajeId: string }
  /** El filtro de arriba del análisis: todas las piezas pasan al mismo período. */
  | { tipo: "periodoAnalisis"; periodo: Periodo }
  /** Abrir una conversación guardada (G5): la mesa vuelve entera, ya saneada. */
  | { tipo: "restaurar"; mesa: Mesa }
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
  /** G9f: la venta pasa a ser con delivery, a cuotas, o en el momento (los dos null). */
  | { tipo: "tipoVenta"; tipoVenta: "rapida" | "delivery" | "cuotas" }
  | { tipo: "entrega"; entrega: Partial<EntregaVenta> }
  | { tipo: "cuotas"; cuotas: Partial<CuotasVenta> }
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
      if (a.mesa === "analisis") return m.analisis ? { ...m, abierta: "analisis" } : m;
      if (a.mesa === "herramienta") return m.herramienta ? { ...m, abierta: "herramienta" } : m;
      if (a.mesa === "lista") return m.lista ? { ...m, abierta: "lista" } : m;
      if (a.mesa === "ficha") return m.ficha ? { ...m, abierta: "ficha" } : m;
      if (a.mesa === "productos") return m.productos ? { ...m, abierta: "productos" } : m;
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

    case "analizar":
      return { ...m, abierta: "analisis", analisis: a.analisis };

    case "usarHerramienta":
      return { ...m, abierta: "herramienta", herramienta: a.herramienta };

    case "abrirLista":
      return { ...m, abierta: "lista", lista: a.lista };

    case "consultaLista":
      return m.lista ? { ...m, lista: { ...m.lista, consulta: a.consulta } } : m;

    case "abrirFicha":
      return { ...m, abierta: "ficha", ficha: a.ficha };

    case "volverALista":
      return m.lista ? { ...m, abierta: "lista" } : m;

    case "abrirProductos":
      return { ...m, abierta: "productos", productos: { mensajeId: a.mensajeId } };

    case "restaurar":
      return a.mesa;

    case "periodoAnalisis":
      if (!m.analisis) return m;
      return { ...m, analisis: { ...m.analisis, vista: conPeriodo(m.analisis.vista, a.periodo) } };

    case "verProducto":
      // Mirando un análisis o una herramienta, el producto va a la mesa con la que se venía trabajando.
      return {
        ...m,
        abierta: m.abierta === "analisis" || m.abierta === "herramienta" ? m.ultima : (m.abierta ?? "venta"),
        pestana: "producto",
        producto: a.producto,
      };

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

    case "tipoVenta":
      return {
        ...m,
        venta: {
          ...m.venta,
          entrega: a.tipoVenta === "delivery" ? (m.venta.entrega ?? { direccion: "", costo: null, notas: "" }) : null,
          cuotas: a.tipoVenta === "cuotas" ? (m.venta.cuotas ?? { cantidad: 2, inicial: null, proxima: "" }) : null,
        },
      };

    case "entrega":
      return { ...m, venta: { ...m.venta, cuotas: null, entrega: { ...(m.venta.entrega ?? { direccion: "", costo: null, notas: "" }), ...a.entrega } } };

    case "cuotas":
      return { ...m, venta: { ...m.venta, entrega: null, cuotas: { ...(m.venta.cuotas ?? { cantidad: 2, inicial: null, proxima: "" }), ...a.cuotas } } };

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
              stock: Number(a.producto.stock) || 0,
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
    // G9f: "es con delivery a…" / "a 3 cuotas".
    if (e.entrega?.direccion) {
      acciones.push({ tipo: "entrega", entrega: { direccion: String(e.entrega.direccion), costo: e.entrega.costo ?? null, notas: String(e.entrega.notas ?? "") } });
      partes.push(`con delivery a ${e.entrega.direccion}`);
    }
    if (e.cuotas?.cantidad) {
      acciones.push({ tipo: "cuotas", cuotas: { cantidad: Number(e.cuotas.cantidad), inicial: e.cuotas.inicial ?? null, proxima: String(e.cuotas.proximaFecha ?? "") } });
      partes.push(`a ${e.cuotas.cantidad} cuotas`);
    }
    if (acciones.length === 0) return null;
    return { acciones, resumen: `${p.items.some((it) => it.producto) ? "Agregado a la venta" : "La venta"} · ${partes.join(", ")}` };
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

/**
 * Lo que le falta a una venta con delivery o a cuotas para registrarse
 * (G9f), como lo pide la Caja: la dirección; el cliente, cuánto paga hoy y
 * la fecha del próximo pago. Vacío = se puede.
 */
export function faltaParaCobrar(v: BorradorVenta): string[] {
  const falta: string[] = [];
  if (v.entrega && !v.entrega.direccion.trim()) falta.push("la dirección de entrega");
  // Como en la Caja: un envío necesita a quién avisarle.
  if (v.entrega && !v.clienteId) falta.push("el cliente (para avisarle del envío)");
  if (v.cuotas) {
    if (!v.clienteId) falta.push("el cliente (a cuotas necesita uno)");
    if (v.cuotas.inicial == null) falta.push("cuánto paga hoy");
    else if (v.cuotas.inicial > totalVenta(v)) falta.push("un pago de hoy que no supere el total");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.cuotas.proxima)) falta.push("la fecha del próximo pago");
    if (!(v.cuotas.cantidad >= 2)) falta.push("en cuántas cuotas (2 o más)");
  }
  return falta;
}

/** El total que se registra: los productos más el envío, si es con delivery. */
export function totalConEnvio(v: BorradorVenta): number {
  return Math.round((totalVenta(v) + (v.entrega?.costo ?? 0)) * 100) / 100;
}
