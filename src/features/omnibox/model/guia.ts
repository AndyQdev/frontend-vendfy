import type { ProductoOpcion } from "@/entities/omnibox/model/types";

import type { BorradorCompra, BorradorVenta, LineaVenta, MetodoPago, TipoMesa } from "./mesa";

/**
 * La Guía: lo que el asistente le DICE a la persona sobre lo que está armando.
 *
 * Errores y advertencias salen de este catálogo fijo, nunca del modelo: un
 * error se dice siempre igual (se aprende, se prueba y la IA no lo puede
 * omitir ni suavizar). Las sugerencias inteligentes llegan en la Fase G2 y
 * usan el mismo formato de mensaje.
 *
 * Todo es puro: se prueba sin navegador (e2e/logic/guia.spec.ts).
 * Ver ASISTENTE-GENERATIVO.md, sección 4.
 */

/**
 * error: bloquea (catálogo fijo). advertencia: no bloquea (catálogo fijo).
 * sugerencia: propone algo útil (reglas del servidor, "no dijiste cuántas",
 * tips del modo aprendiz); tiene reglas anti-molestia (memoria-guia.ts).
 */
export type NivelGuia = "error" | "advertencia" | "sugerencia";

export type CodigoGuia =
  | "VENTA_VACIA"
  | "FALTA_PAGO"
  | "SIN_STOCK"
  | "COMPRA_VACIA"
  | "RENGLON_SIN_RESOLVER"
  | "COSTO_CERO"
  | "COSTO_SUBIO"
  | "SERVIDOR"
  // ---- sugerencias (G2a): las del servidor y las de la pantalla
  | "CANTIDAD_NO_DICHA"
  | "CANTIDAD_INUSUAL"
  | "QUEDA_POCO"
  | "COMPLEMENTO_CLIENTE"
  | "VENTA_GRANDE_SIN_CLIENTE"
  | "DESCUENTO"
  | "PROVEEDOR_HABITUAL"
  | "COMPRA_CORTA"
  | "MARGEN_BAJO"
  | "TIP_DECIR_CANTIDAD"
  | "TIP_COBRAR_HABLANDO"
  | "TIP_FOTO_FACTURA";

/** Lo que resuelve el mensaje con un toque. */
export type AccionGuia =
  /** Elegir el método de pago (y, si venía de "cobrar", cobrar enseguida). */
  | { tipo: "pago"; pago: MetodoPago; etiqueta: string }
  /** Llevar la vista al campo del problema. */
  | { tipo: "ver"; campo: string; etiqueta: string }
  | { tipo: "cantidad"; mesa: TipoMesa; productId: string; cantidad: number; etiqueta: string }
  | { tipo: "precio"; productId: string; precio: number; etiqueta: string }
  | { tipo: "agregar"; producto: ProductoOpcion; cantidad: number; etiqueta: string }
  /**
   * Abrir la compra con el producto cargado. `costo` null: se busca el último
   * que se pagó al tocarlo (la venta no lo conoce).
   */
  | { tipo: "comprar"; producto: ProductoOpcion; cantidad: number; costo: number | null; costoAnterior: number | null; etiqueta: string }
  | { tipo: "proveedor"; proveedor: string; etiqueta: string }
  | { tipo: "verProducto"; producto: ProductoOpcion; etiqueta: string }
  /** "No, gracias": cierra y se recuerda. */
  | { tipo: "descartar"; etiqueta: string };

export interface MensajeGuia {
  codigo: CodigoGuia;
  nivel: NivelGuia;
  mesa: TipoMesa;
  texto: string;
  /**
   * El `data-campo` del elemento que tiene el problema: lo que brilla.
   * Ej.: "pago", "cliente", "cantidad:<productId>", "costo:<productId>",
   * "renglon:<mensajeId>:<indice>".
   */
  campo?: string;
  acciones: AccionGuia[];
  /** Identifica el problema concreto: el mismo error en otra línea es otro. */
  clave: string;
  /** Sugerencias: 0 a 1. Por debajo de CONFIANZA_MINIMA no se dicen. */
  confianza?: number;
}

/** La sugerencia tal como llega de `POST /api/omnibox/sugerencias`. */
export interface SugerenciaServidor {
  codigo: CodigoGuia;
  mesa: TipoMesa;
  texto: string;
  campo?: string;
  acciones: AccionGuia[];
  confianza: number;
  clave: string;
}

export function deSugerencia(s: SugerenciaServidor): MensajeGuia {
  return { ...s, nivel: "sugerencia" };
}

/** Una línea de la venta como producto (para "Cargar compra"). */
export function productoDeLinea(l: LineaVenta): ProductoOpcion {
  return {
    storeProductId: l.storeProductId,
    productId: l.productId,
    nombre: l.nombre,
    codigo: null,
    imagen: l.imagen,
    precio: l.precio,
    stock: l.stock,
    similitud: 1,
  };
}

/** Cuánto tiene que subir el costo para avisar: ruido no, cambios reales sí. */
export const UMBRAL_COSTO_SUBIO = 0.15;

const PAGOS: { pago: MetodoPago; etiqueta: string }[] = [
  { pago: "efectivo", etiqueta: "Efectivo" },
  { pago: "qr", etiqueta: "QR" },
  { pago: "tarjeta", etiqueta: "Tarjeta" },
];

function bs(n: number): string {
  return `Bs ${n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ------------------------------------------------------------ el catálogo

export const MENSAJES = {
  ventaVacia(): MensajeGuia {
    return {
      codigo: "VENTA_VACIA",
      nivel: "error",
      mesa: "venta",
      texto: "No hay nada para cobrar todavía. Decí qué se lleva o tocá un producto.",
      acciones: [],
      clave: "VENTA_VACIA",
    };
  },
  faltaPago(): MensajeGuia {
    return {
      codigo: "FALTA_PAGO",
      nivel: "error",
      mesa: "venta",
      texto: "Falta el método de pago. ¿Con qué paga?",
      campo: "pago",
      acciones: PAGOS.map((p) => ({ tipo: "pago" as const, ...p })),
      clave: "FALTA_PAGO",
    };
  },
  sinStock(
    l: { productId: string; nombre: string; cantidad: number; stock: number; storeProductId?: string; imagen?: string | null; precio?: number },
    nivel: NivelGuia = "advertencia",
  ): MensajeGuia {
    const campo = `cantidad:${l.productId}`;
    // D3: "No tenés stock, ¿querés agregar?": se ofrece cargar la compra de lo
    // que falta. Necesita la línea completa (storeProductId) para armarla.
    const comprar: AccionGuia[] =
      l.storeProductId != null
        ? [
            {
              tipo: "comprar",
              producto: productoDeLinea({
                productId: l.productId,
                storeProductId: l.storeProductId,
                nombre: l.nombre,
                imagen: l.imagen ?? null,
                precio: l.precio ?? 0,
                cantidad: l.cantidad,
                stock: l.stock,
              }),
              cantidad: Math.max(1, l.cantidad - Math.max(0, l.stock)),
              costo: null,
              costoAnterior: null,
              etiqueta: "Cargar compra",
            },
          ]
        : [];
    return {
      codigo: "SIN_STOCK",
      nivel,
      mesa: "venta",
      texto:
        l.stock <= 0
          ? `No tenés stock de ${l.nombre} en esta tienda.`
          : `De ${l.nombre} pedís ${l.cantidad} y tenés ${l.stock}.`,
      campo,
      acciones: [{ tipo: "ver", campo, etiqueta: "Ver cantidad" }, ...comprar],
      clave: `SIN_STOCK:${l.productId}`,
    };
  },
  compraVacia(): MensajeGuia {
    return {
      codigo: "COMPRA_VACIA",
      nivel: "error",
      mesa: "compra",
      texto: "La compra está vacía. Decí qué llegó, por ejemplo “compré 10 cocas a 11”.",
      acciones: [],
      clave: "COMPRA_VACIA",
    };
  },
  renglonSinResolver(claves: string[]): MensajeGuia {
    const campo = `renglon:${claves[0]}`;
    const n = claves.length;
    return {
      codigo: "RENGLON_SIN_RESOLVER",
      nivel: "error",
      mesa: "compra",
      texto:
        n === 1
          ? "Falta decir a qué producto corresponde un renglón de la factura."
          : `Faltan ${n} renglones de la factura: decí a qué producto corresponde cada uno.`,
      campo,
      acciones: [{ tipo: "ver", campo, etiqueta: n === 1 ? "Ver el renglón" : "Ver el primero" }],
      clave: "RENGLON_SIN_RESOLVER",
    };
  },
  costoCero(l: { productId: string; nombre: string }): MensajeGuia {
    const campo = `costo:${l.productId}`;
    return {
      codigo: "COSTO_CERO",
      nivel: "advertencia",
      mesa: "compra",
      texto: `${l.nombre} no tiene costo: la ganancia de sus ventas va a salir mal.`,
      campo,
      acciones: [{ tipo: "ver", campo, etiqueta: "Poner el costo" }],
      clave: `COSTO_CERO:${l.productId}`,
    };
  },
  costoSubio(l: { productId: string; nombre: string; costo: number; costoAnterior: number }): MensajeGuia {
    const campo = `costo:${l.productId}`;
    const pct = Math.round(((l.costo - l.costoAnterior) / l.costoAnterior) * 100);
    return {
      codigo: "COSTO_SUBIO",
      nivel: "advertencia",
      mesa: "compra",
      texto: `${l.nombre} te sale ${pct} % más caro que la última vez (${bs(l.costoAnterior)} → ${bs(l.costo)}).`,
      campo,
      acciones: [{ tipo: "ver", campo, etiqueta: "Revisar el costo" }],
      clave: `COSTO_SUBIO:${l.productId}`,
    };
  },
  /**
   * "Vendé coca" sin decir cuántas: se puso 1. No es un error (1 es lo más
   * común) sino una pregunta con los números a un toque.
   */
  cantidadNoDicha(l: { productId: string; nombre: string }, mesa: TipoMesa): MensajeGuia {
    const opciones = mesa === "compra" ? [6, 12, 24] : [2, 3, 6];
    return {
      codigo: "CANTIDAD_NO_DICHA",
      nivel: "sugerencia",
      mesa,
      texto: `No dijiste cuántas de ${l.nombre}: puse 1. ¿Son más?`,
      campo: `cantidad:${l.productId}`,
      acciones: [
        ...opciones.map((n) => ({ tipo: "cantidad" as const, mesa, productId: l.productId, cantidad: n, etiqueta: String(n) })),
        { tipo: "descartar" as const, etiqueta: "Es 1" },
      ],
      confianza: 0.9,
      clave: `CANTIDAD_NO_DICHA:${mesa}:${l.productId}`,
    };
  },
  tipDecirCantidad(): MensajeGuia {
    return tip("TIP_DECIR_CANTIDAD", "Tip: también podés decir «que sean 3» o «sacá la coca», sin tocar nada.");
  },
  tipCobrarHablando(): MensajeGuia {
    return tip("TIP_COBRAR_HABLANDO", "Tip: la próxima, decí «cobrale con QR» y se cobra solo.");
  },
  tipFotoFactura(): MensajeGuia {
    return tip("TIP_FOTO_FACTURA", "Tip: si tenés la factura, sacale una foto con la cámara de abajo y se carga sola.");
  },
  servidor(texto: string, mesa: TipoMesa): MensajeGuia {
    return { codigo: "SERVIDOR", nivel: "error", mesa, texto, acciones: [], clave: `SERVIDOR:${texto}` };
  },
};

function tip(codigo: CodigoGuia, texto: string): MensajeGuia {
  return {
    codigo,
    nivel: "sugerencia",
    mesa: "venta",
    texto,
    acciones: [{ tipo: "descartar", etiqueta: "Entendido" }],
    confianza: 1,
    clave: codigo,
  };
}

/**
 * ¿Sigue valiendo "no dijiste cuántas"? Mientras la línea exista y siga en 1:
 * si ya la cambió (tocando o hablando), la pregunta está contestada.
 */
export function cantidadNoDichaVigente(m: MensajeGuia, venta: BorradorVenta, compra: BorradorCompra): boolean {
  const productId = m.clave.split(":")[2];
  const lineas: { productId: string; cantidad: number }[] = m.mesa === "venta" ? venta.lineas : compra.lineas;
  return lineas.some((l) => l.productId === productId && l.cantidad === 1);
}

// ------------------------------------------------------------ revisar

/**
 * Lo que la Guía ve en la venta. Los errores bloquean el cobro; las
 * advertencias no (D3: faltar stock se avisa, el servidor decide).
 *
 * `pagoDicho`: el método que vino en la misma frase ("cobrale con QR") y
 * todavía no llegó al borrador.
 */
export function revisarVenta(v: BorradorVenta, pagoDicho?: MetodoPago | null): MensajeGuia[] {
  if (v.lineas.length === 0) return [MENSAJES.ventaVacia()];
  const out: MensajeGuia[] = [];
  if (!(pagoDicho ?? v.pago)) out.push(MENSAJES.faltaPago());
  for (const l of v.lineas) {
    if (l.cantidad > l.stock) out.push(MENSAJES.sinStock(l));
  }
  return out;
}

export function revisarCompra(c: BorradorCompra): MensajeGuia[] {
  const out: MensajeGuia[] = [];
  if (c.porResolver.length > 0) out.push(MENSAJES.renglonSinResolver(c.porResolver));
  if (c.lineas.length === 0 && c.porResolver.length === 0) return [MENSAJES.compraVacia()];
  for (const l of c.lineas) {
    if (!(l.costo > 0)) out.push(MENSAJES.costoCero(l));
    else if (l.costoAnterior != null && l.costoAnterior > 0 && (l.costo - l.costoAnterior) / l.costoAnterior >= UMBRAL_COSTO_SUBIO) {
      out.push(MENSAJES.costoSubio({ ...l, costoAnterior: l.costoAnterior }));
    }
  }
  return out;
}

export function errores(ms: MensajeGuia[]): MensajeGuia[] {
  return ms.filter((m) => m.nivel === "error");
}

/** El que se muestra: primero los errores, y entre iguales el primero. */
export function principal(ms: MensajeGuia[]): MensajeGuia | null {
  return errores(ms)[0] ?? ms[0] ?? null;
}

/**
 * Las advertencias que aparecieron con un cambio (estaban en `despues` y no en
 * `antes`). Es lo que la Guía anuncia cuando el cambio vino del chat: la
 * persona no está mirando el panel, así que hay que decírselo.
 */
export function nuevasAdvertencias(antes: MensajeGuia[], despues: MensajeGuia[]): MensajeGuia[] {
  const ya = new Set(antes.map((m) => m.clave));
  return despues.filter((m) => m.nivel === "advertencia" && !ya.has(m.clave));
}

/**
 * ¿Sigue valiendo el mensaje con el borrador como está ahora? Cuando deja de
 * valer (eligió el pago, bajó la cantidad, resolvió el renglón) la Guía calla
 * sola: un aviso de algo ya arreglado es ruido.
 */
export function sigueVigente(m: MensajeGuia, venta: BorradorVenta, compra: BorradorCompra): boolean {
  // Lo que respondió el servidor no se puede recalcular acá: vale hasta que
  // se toque el borrador (quien lo cierra es la pantalla).
  if (m.codigo === "SERVIDOR") return true;
  // Sin stock según el servidor: vale mientras la línea siga pidiendo lo mismo.
  if (m.codigo === "SIN_STOCK" && m.nivel === "error") {
    const [, productId, cantidad] = m.clave.split(":");
    return venta.lineas.some((l) => l.productId === productId && String(l.cantidad) === cantidad);
  }
  const actuales = m.mesa === "venta" ? revisarVenta(venta) : revisarCompra(compra);
  return actuales.some((a) => a.clave === m.clave);
}

// ------------------------------------------------------------ el servidor

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Los productos sin stock que nombra un error del servidor. Hay dos formatos:
 *   - OrderService: `No hay stock suficiente de: Aceite (hay 17, se piden 999); …`
 *   - el trigger de la base: `Stock insuficiente de "Aceite": hay 0, se intento descontar 5.`
 */
export function faltantesDelServidor(texto: string): { nombre: string; hay: number }[] {
  const out: { nombre: string; hay: number }[] = [];
  const lista = texto.match(/No hay stock suficiente de:\s*(.+?)\.\s*(?:Si es|$)/s);
  if (lista) {
    for (const parte of lista[1].split(";")) {
      const m = parte.trim().match(/^(.+?)\s*\(hay\s*([\d.,]+)/);
      if (m) out.push({ nombre: m[1].trim(), hay: Number(m[2].replace(",", ".")) });
    }
  }
  for (const m of texto.matchAll(/Stock insuficiente de "([^"]+)":\s*hay\s*([\d.,]+)/g)) {
    out.push({ nombre: m[1].trim(), hay: Number(m[2].replace(",", ".")) });
  }
  return out;
}

/**
 * Un error del servidor al cobrar, como mensaje de la Guía. Si nombra un
 * producto del carrito, señala SU cantidad; si no, se dice tal cual.
 */
export function errorDeCobro(texto: string, v: BorradorVenta): MensajeGuia {
  for (const f of faltantesDelServidor(texto)) {
    const linea = v.lineas.find((l) => normalizar(l.nombre) === normalizar(f.nombre));
    if (linea) {
      const m = MENSAJES.sinStock({ ...linea, stock: f.hay }, "error");
      return { ...m, clave: `${m.clave}:${linea.cantidad}` };
    }
  }
  return MENSAJES.servidor(texto, "venta");
}
