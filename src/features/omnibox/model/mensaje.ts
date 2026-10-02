import type {
  CompraRegistrada,
  HerramientaGenerada,
  ProductoOpcion,
  Propuesta,
  VentaCobrada,
  VistaFijada,
} from "@/entities/omnibox/model/types";

import type { PropuestaPrecios } from "./herramienta";

/**
 * Un intercambio del chat: lo que dijo la persona y lo que el sistema propuso.
 *
 * Van juntos en un solo objeto, no en dos mensajes sueltos: la respuesta es
 * SIEMPRE a esa pregunta, y cuando se confirma o se cancela lo que cambia es
 * ese par. Con mensajes sueltos habría que buscar cuál responde a cuál.
 */
export interface Mensaje {
  id: string;
  /** null mientras se transcribe un dictado: todavía no se sabe qué dijo. */
  texto: string | null;
  porVoz: boolean;
  /** La foto o el PDF que se mandó (una factura), en vez de una frase. */
  adjunto?: { url: string; nombre: string; esPdf: boolean };
  hora: Date;
  fase: "pensando" | "listo" | "error";
  propuesta?: Propuesta;
  /** Por qué falló la llamada. No es "no entendí": es que no hubo respuesta. */
  error?: string;
  /** Qué pasó con la acción propuesta. */
  desenlace?: Desenlace;
  /**
   * Algo que pasó en el panel, no una respuesta a una frase: "Venta #1043
   * cobrada". Va en el hilo para que la conversación cuente todo lo que se
   * hizo, se haya hecho hablando o tocando. No lleva burbuja del usuario.
   */
  evento?: EventoVenta | EventoCompra;
  /** "¿Qué pasa si subo 10 %…?" (G6): la herramienta a medida que responde. */
  herramienta?: EstadoHerramienta;
  /**
   * Lo que propuso una herramienta (G6): una tarjeta N1 más, que se confirma.
   * Como un evento, no nace de una frase: no lleva burbuja del usuario.
   */
  precios?: PreciosPropuestos;
}

/**
 * Una herramienta tarda (la escribe el modelo más capaz, y se revisa y se
 * compila): se pide aparte de la frase y la tarjeta muestra el progreso.
 */
export type EstadoHerramienta =
  | { fase: "armando"; desde: number }
  | {
      fase: "lista";
      generada: HerramientaGenerada;
      /** Ya falló una vez al dibujarse y se corrigió: la próxima falla no se corrige. */
      corregida?: boolean;
    }
  /** No se pudo armar, o se rompió al dibujarse aun corregida (quedan sus datos en tabla). */
  | { fase: "error"; error: string; generada?: HerramientaGenerada };

export interface PreciosPropuestos {
  propuesta: PropuestaPrecios;
  /** La herramienta que lo propuso: su mensaje y su título. */
  origen: { mensajeId: string; titulo: string };
  estado: "pendiente" | "aplicando" | "aplicado" | "cancelado" | "error";
  error?: string;
  resumen?: string;
}

/** Lo que propuso una herramienta, como mensaje del hilo (sin burbuja). */
export function mensajeDePrecios(propuesta: PropuestaPrecios, origen: PreciosPropuestos["origen"]): Mensaje {
  return {
    id: crypto.randomUUID(),
    texto: null,
    porVoz: false,
    hora: new Date(),
    fase: "listo",
    precios: { propuesta, origen, estado: "pendiente" },
  };
}

export interface EventoCompra {
  tipo: "compra";
  compra: CompraRegistrada;
  lineas: { nombre: string; imagen: string | null; cantidad: number; costo: number; stock?: number }[];
}

export interface EventoVenta {
  tipo: "venta";
  venta: VentaCobrada;
  /** Lo que se vendió, para la tarjeta (el pedido no vuelve con fotos). */
  lineas: { nombre: string; imagen: string | null; cantidad: number }[];
  anulada?: boolean;
}

/** Un mensaje que no nace de una frase sino del panel. */
export function mensajeDeEvento(evento: EventoVenta | EventoCompra): Mensaje {
  return { id: crypto.randomUUID(), texto: null, porVoz: false, hora: new Date(), fase: "listo", evento };
}

export type Desenlace =
  | {
      tipo: "hecho";
      resumen: string;
      despues: number | null;
      /** Con lo que se ejecutó de verdad: puede diferir de lo propuesto si corrigió. */
      entidades: Record<string, unknown>;
    }
  | { tipo: "cancelado" }
  /** Una frase aplicada a la venta del panel: "Agregado a la venta · 2 × Coca". */
  | { tipo: "mesa"; resumen: string; imagen?: string | null }
  /**
   * La frase no se pudo aplicar todavía: falta algo que la Guía está pidiendo
   * ("cobrá" sin método de pago). Cuando se resuelve, la tarjeta pasa a ser
   * la venta cobrada.
   */
  | { tipo: "guia"; texto: string; nivel: "error" | "advertencia" };

/**
 * Abrir una vista fijada (G4) queda en el hilo como si se hubiera preguntado:
 * el nombre como frase y la vista como respuesta. Sin IA (capa C0): la vista
 * ya está armada; los datos se leen al día al abrirla.
 */
export function mensajeDeVistaFijada(f: VistaFijada): Mensaje {
  return {
    ...nuevoMensaje(f.nombre, false),
    fase: "listo",
    propuesta: propuestaLocal("analizar", { titulo: f.vista.titulo, entidades: { fijada: f.id }, vista: f.vista }),
  };
}

/**
 * Una frase que contestó a la Guía (G2b: "6", "con QR", "sí"): se resolvió
 * en la pantalla, sin servidor, y en el hilo queda qué pasó.
 */
export function mensajeRespuestaGuia(texto: string, porVoz: boolean, resumen: string): Mensaje {
  return {
    ...nuevoMensaje(texto, porVoz),
    fase: "listo",
    propuesta: propuestaLocal("responder_guia", { titulo: "Respuesta a la Guía" }),
    desenlace: { tipo: "mesa", resumen },
  };
}

/** Una propuesta armada en la pantalla, sin IA (capa C0). */
export function propuestaLocal(intencion: string, extra: Partial<Propuesta> = {}): Propuesta {
  return {
    intencion,
    titulo: null,
    confianza: 1,
    capa: "C0",
    entidades: {},
    faltan: [],
    opciones: [],
    noEncontrado: null,
    requiereConfirmacion: false,
    vistaPrevia: null,
    ejecutable: true,
    resultado: null,
    aviso: null,
    producto: null,
    bloqueo: null,
    ms: 0,
    ...extra,
  };
}

export function nuevoMensaje(texto: string | null, porVoz: boolean): Mensaje {
  return {
    id: crypto.randomUUID(),
    texto,
    porVoz,
    hora: new Date(),
    fase: "pensando",
  };
}

/**
 * Recalcula el "después" cuando la persona corrige un número en la tarjeta.
 *
 * Es la misma cuenta que hace el backend en `vistaPrevia`; se repite acá para
 * que el diff cambie mientras escribe, sin ir al servidor por cada tecla. El
 * "antes" no se toca: ese sí lo sabe solo el servidor.
 */
export function recalcularDespues(
  intencion: string | null,
  antes: number,
  entidades: Record<string, unknown>,
): number {
  if (intencion === "cambiar_precio") return Number(entidades.precio ?? antes);
  const cantidad = Number(entidades.cantidad ?? 0);
  if (intencion === "registrar_entrada") return antes + cantidad;
  if (intencion === "venta_mostrador") return antes - cantidad;
  return cantidad; // ajustar_stock: dice cuánto QUEDA
}

/** "10:24": 24 horas. El "a. m." de es-BO duplica el ancho y no aporta. */
export function hora(d: Date): string {
  return d.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

/**
 * Completa una propuesta con lo que faltaba: el producto elegido o un dato.
 *
 * Devuelve la propuesta de nuevo, NO ejecuta. Llenar la cantidad que faltaba no
 * es confirmar: lo que toca stock o dinero vuelve a pasar por la tarjeta con su
 * diff, igual que si hubiera venido completo desde el principio.
 *
 * La vista previa se arma acá porque el servidor no pudo: le faltaba el dato.
 * El "antes" sale del producto buscado, que trae stock y precio.
 */
export function completar(
  p: Propuesta,
  cambios: Record<string, unknown>,
  producto?: ProductoOpcion,
): Propuesta {
  const entidades = { ...p.entidades, ...cambios };
  const prod = producto ?? p.producto;

  const faltan = p.faltan.filter((f) =>
    f.slot === "producto"
      ? !entidades.productId
      : entidades[f.slot] == null || entidades[f.slot] === "",
  );
  const listo = faltan.length === 0 && p.bloqueo == null;

  let vistaPrevia = p.vistaPrevia;
  if (listo && p.requiereConfirmacion && prod) {
    const esPrecio = p.intencion === "cambiar_precio";
    // Si el servidor ya sabía el "antes", manda el servidor.
    const antes = p.vistaPrevia?.antes ?? (esPrecio ? prod.precio : prod.stock);
    vistaPrevia = {
      etiqueta: esPrecio ? "Precio" : "Stock",
      antes,
      despues: recalcularDespues(p.intencion, antes, entidades),
    };
  }

  return {
    ...p,
    entidades,
    producto: prod ?? null,
    faltan,
    opciones: [],
    noEncontrado: null,
    ejecutable: listo,
    vistaPrevia,
  };
}
