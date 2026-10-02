/**
 * Espejo de lo que devuelve `/api/omnibox/*`.
 *
 * Las definiciones viven en `ventas-service/src/omnibox/`. Si cambian allá,
 * cambian acá: es el contrato entre los dos proyectos.
 */

export interface ProductoOpcion {
  storeProductId: string;
  productId: string;
  nombre: string;
  codigo: string | null;
  imagen: string | null;
  precio: number;
  stock: number;
  similitud: number;
}

export interface Propuesta {
  intencion: string | null;
  titulo: string | null;
  confianza: number;
  /** En qué capa se resolvió. C0 = sin gastar un solo token. */
  capa: "C0" | "C1" | "C2" | "C3";
  entidades: Record<string, unknown>;
  faltan: { slot: string; pregunta: string }[];
  opciones: ProductoOpcion[];
  /** Lo que se buscó en el catálogo y no apareció. */
  noEncontrado: string | null;
  requiereConfirmacion: boolean;
  /** Qué va a cambiar si confirma. Lo que hace revisable la tarjeta. */
  vistaPrevia: { etiqueta: string; antes: number; despues: number } | null;
  ejecutable: boolean;
  resultado: { resumen: string; datos?: any } | null;
  aviso: string | null;
  /** El producto resuelto, con foto: lo que deja reconocerlo de un vistazo. */
  producto: ProductoOpcion | null;
  /** Se entendió pero no se puede: sin permiso, o sin ejecutor todavía. */
  bloqueo: "sin-permiso" | "sin-ejecutor" | null;
  /** Clientes para elegir ("es para José" con dos José). Vacío = no existe. */
  clientes?: ClienteOpcion[];
  /** Líneas del carrito entre las que hay que elegir. */
  lineas?: LineaContexto[];
  /** Un pedido de varias cosas: cada producto resuelto por separado. */
  items?: ItemPedido[];
  /** El cliente del pedido ya puesto en la venta (lo marca el panel). */
  clienteAplicado?: string;
  /** Último costo y promedio por producto: lo que se precarga en la compra. */
  costos?: Record<string, CostoProducto>;
  /** Una pregunta de análisis: la vista que armó la IA (G3). Se dibuja en el panel. */
  vista?: VistaSpec;
  ms: number;
}

// ------------------------------------------------------------ vistas (G3)
// Espejo de `ventas-service/src/omnibox/model/vistas.ts`.

export type PeriodoFijo = "hoy" | "ayer" | "7dias" | "30dias" | "90dias" | "este_mes" | "mes_pasado" | "este_anio";
/** Los relativos, o un mes con nombre: "mes:2026-08" (para "septiembre contra agosto"). */
export type Periodo = PeriodoFijo | `mes:${string}`;

export type TipoColumna = "texto" | "dinero" | "numero" | "porcentaje" | "fecha" | "hora" | "producto";

export interface ColumnaVista {
  clave: string;
  titulo: string;
  tipo: TipoColumna;
}

/** Lo que devuelve una fuente: siempre la misma forma, lea lo que lea. */
export interface TablaVista {
  columnas: ColumnaVista[];
  /** Las claves que empiezan con "_" (la foto del producto) no son columnas. */
  filas: Record<string, unknown>[];
  /** "Últimos 7 días": el subtítulo de la pieza. */
  periodo?: string;
}

export type FormaGrafico = "barras" | "lineas" | "area" | "torta";

type Params = Record<string, unknown>;

export type PiezaVista =
  | { id: string; tipo: "indicadores"; fuente: "kpis"; params: Params; titulo?: string }
  | { id: string; tipo: "grafico"; forma: FormaGrafico; fuente: string; params: Params; x: string; y: string[]; titulo: string }
  | { id: string; tipo: "tabla"; fuente: string; params: Params; columnas?: string[]; titulo: string }
  | { id: string; tipo: "ranking"; fuente: string; params: Params; etiqueta: string; valor: string; titulo: string }
  // G4: un período contra otro (los params van sin período), un hallazgo con
  // regla fija, y el puente a N1 (arma la compra, nunca la registra).
  | {
      id: string;
      tipo: "comparativa";
      fuente: string;
      params: Params;
      periodos: [Periodo, Periodo];
      etiqueta: string;
      valor: string;
      titulo: string;
    }
  | { id: string; tipo: "alerta"; fuente: string; params: Params; titulo?: string }
  | { id: string; tipo: "accion"; accion: "reponer"; fuente: string; params: Params; titulo: string }
  | { id: string; tipo: "conclusion" };

/** Ya validada por el servidor: fuentes, columnas y parámetros existen. */
export interface VistaSpec {
  titulo: string;
  piezas: PiezaVista[];
}

/** Una conversación guardada, en la lista (G5). */
export interface ConversacionResumen {
  id: string;
  titulo: string;
  actualizada: string;
  mensajes: number;
  /** Lo que quedó a medio armar: "Venta en curso · 2". */
  enCurso: { venta: number; compra: number };
}

/** Una conversación entera, para abrirla: el chat y la mesa como se guardaron. */
export interface ConversacionGuardada extends ConversacionResumen {
  contenido: unknown[];
  mesa: unknown;
}

/** Una vista fijada: el tablero propio de la tienda (G4). Se guarda la vista, no los números. */
export interface VistaFijada {
  id: string;
  nombre: string;
  pregunta: string;
  vista: VistaSpec;
  creada: string;
}

/**
 * Una herramienta a medida (G6, nivel N3): un simulador o una calculadora que
 * escribió la IA. El servidor ya revisó el código y lo compiló; corre en un
 * iframe aislado con una FOTO de los datos (no los vuelve a leer).
 */
export interface HerramientaGenerada {
  id: string;
  titulo: string;
  descripcion: string;
  plan: { titulo: string; descripcion: string; fuentes: { alias: string; fuente: string; params: Record<string, unknown> }[] };
  /** El fuente: si falla al dibujarse, se manda a corregir con el error. */
  tsx: string;
  /** Lo que corre en el iframe (CommonJS, ya sin JSX). */
  codigo: string;
  datos: Record<string, TablaVista>;
  modelo: string;
  intentos: number;
  ms: number;
  /** Cuándo se leyeron los datos (ISO): la herramienta no los vuelve a leer. */
  creada: string;
}

export interface CostoProducto {
  productId: string;
  ultimoCosto: number | null;
  ultimoProveedor: string | null;
  costoPromedio: number | null;
}

/** Lo que devuelve registrar una compra: lo que muestra su tarjeta en el chat. */
export interface CompraRegistrada {
  purchaseOrderId: string;
  referencia: string | null;
  proveedor: string | null;
  total: number;
  unidades: number;
  /** La foto de la factura, si la compra salió de una foto. */
  adjunto?: string | null;
}

/** Un producto de un pedido dicho de una vez ("un Absolut y un Icon"). */
export interface ItemPedido {
  texto: string;
  buscado: string;
  cantidad: number;
  precio: number | null;
  /** Claro: se agrega directo. */
  producto: ProductoOpcion | null;
  /** Dudoso: los parecidos, para elegir uno o varios. */
  opciones: ProductoOpcion[];
  /** No existe: lo que se buscó. */
  noEncontrado: string | null;
  /** Lo que ya se agregó desde este renglón (lo marca el panel). */
  agregados?: string[];
  /** Un renglón de la factura que se decidió no cargar (lo marca el panel). */
  omitido?: boolean;
  /** false = la frase no dijo cuántos y se puso 1 (la Guía puede preguntar). */
  cantidadDicha?: boolean;
}

/** Una línea de la venta abierta, como viaja al servidor con cada frase. */
export interface LineaContexto {
  productId: string;
  nombre: string;
  cantidad: number;
}

/**
 * Las intenciones que actúan sobre la venta del panel. El servidor dice qué
 * hacer y con qué; el panel lo aplica con el mismo reductor que sus botones.
 */
export const INTENCIONES_DE_VENTA = new Set([
  // compra (Fase 4): mismo camino, otra mesa
  "agregar_a_compra",
  "cambiar_costo_compra",
  "elegir_proveedor",
  "registrar_compra",
  // venta
  "agregar_a_venta",
  "quitar_de_venta",
  "cambiar_cantidad_venta",
  "elegir_cliente",
  "elegir_pago",
  "cobrar",
  "vaciar_venta",
]);

export function esDeVenta(p: Propuesta): boolean {
  return Boolean(p.intencion && INTENCIONES_DE_VENTA.has(p.intencion));
}

export interface IntencionDisponible {
  id: string;
  titulo: string;
  ejemplos: string[];
  confirmar: "siempre" | "si-dudo" | "nunca";
  disponible: boolean;
}

/**
 * Los cuatro estados en que puede quedar una propuesta.
 *
 * Se deriva de la respuesta, NO viene del backend ni lo decide el modelo: una
 * función pura de la propuesta. Así la tarjeta siempre se ve igual para el
 * mismo caso, y se puede probar sin navegador.
 */
export type EstadoTarjeta =
  | "resuelta"
  | "sin-permiso"
  | "espera-confirmacion"
  | "ambiguedad"
  | "sin-producto"
  | "falta-dato"
  | "pedido"
  | "confirmar-compra"
  | "elegir-cliente"
  | "elegir-linea"
  | "aviso"
  | "vista"
  | "herramienta"
  | "sin-entender";

export function estadoDe(p: Propuesta): EstadoTarjeta {
  if (p.resultado) return "resuelta";
  if (p.bloqueo === "sin-permiso") return "sin-permiso";
  if (!p.intencion) return "sin-entender";
  // Un análisis: la respuesta es la vista del panel, no una tarjeta con botones.
  if (p.vista) return "vista";
  // Una herramienta a medida (G6): se arma aparte y su tarjeta muestra el progreso.
  if (p.intencion === "simular") return "herramienta";
  if (p.items) return "pedido";
  // Una compra recibida no se puede anular: se confirma con su propia tarjeta.
  if (p.intencion === "registrar_compra" && p.ejecutable) return "confirmar-compra";
  // Los dos José, o el que no existe: se elige (o se crea) antes de seguir.
  if (p.clientes && !p.ejecutable) return "elegir-cliente";
  if (p.lineas && p.lineas.length > 0) return "elegir-linea";
  if (p.opciones.length > 0) return "ambiguedad";
  // Nombró un producto que no existe: no es un dato que falte, y preguntarle
  // "¿qué producto?" a quien acaba de nombrarlo no tiene sentido.
  if (p.noEncontrado) return "sin-producto";
  if (p.faltan.length > 0) return "falta-dato";
  if (p.requiereConfirmacion && p.ejecutable) return "espera-confirmacion";
  // Una frase de la venta que no se puede aplicar ("no hay nada para cobrar",
  // "eso no está en la venta"): se dice por qué, sin ofrecer sugerencias de
  // otra cosa — la persona sabe lo que quería.
  if (esDeVenta(p) && p.aviso) return "aviso";
  // Entendió pero no puede: sin permiso, o sin ejecutor todavía.
  return "sin-entender";
}

/**
 * El texto del botón principal, por intención.
 *
 * Sale de acá y no de una plantilla genérica: "Guardar precio" dice qué va a
 * pasar; "Aceptar" obliga a releer la tarjeta para saberlo. Y sobre todo, NO lo
 * redacta el modelo — el mismo caso tiene siempre el mismo botón, que es lo que
 * permite escribir una prueba y que la gente lo aprenda.
 */
const ACCION: Record<string, string> = {
  registrar_entrada: "Confirmar entrada",
  ajustar_stock: "Ajustar",
  cambiar_precio: "Guardar precio",
  crear_producto: "Crear producto",
  venta_mostrador: "Registrar venta",
  cancelar_pedido: "Sí, cancelar",
  ocultar_de_web: "Aplicar",
};

export function textoAccion(intencion: string | null): string {
  return (intencion && ACCION[intencion]) || "Confirmar";
}

/** Las que no se pueden deshacer de un clic piden un botón más serio. */
export function esDestructiva(intencion: string | null): boolean {
  return intencion === "cancelar_pedido" || intencion === "cambiar_precio";
}

/**
 * El título de la tarjeta, corto.
 *
 * El del catálogo ("Registrar mercadería que llegó") está pensado para el
 * router; en la tarjeta, al lado de la foto, sobra la mitad.
 */
const TITULO: Record<string, string> = {
  registrar_entrada: "Registrar mercadería",
  ajustar_stock: "Ajustar stock",
  cambiar_precio: "Cambiar precio",
  consultar_stock: "Resultados de stock",
  buscar_producto: "Resultados de stock",
  consultar_ventas: "Ventas",
};

export function tituloCorto(p: Propuesta): string {
  return (p.intencion && TITULO[p.intencion]) || p.titulo || "Resultado";
}

/** La ficha completa de un producto, para el panel de la derecha. */
export interface FichaProducto {
  productId: string;
  storeProductId: string;
  nombre: string;
  codigo: string | null;
  descripcion: string | null;
  imagenes: string[];
  marca: string | null;
  categoria: string | null;
  especificaciones: Record<string, unknown> | null;
  etiquetas: string[];
  unidad: string;
  precio: number;
  stock: number;
  /** Esta tienda primero, después las otras del dueño que venden el producto. */
  stockPorTienda: { storeId: string; nombre: string; stock: number; esEsta: boolean }[];
  /** "No tenés en esta tienda, pero sí en…" — solo cuando aplica (D4). */
  aviso: string | null;
  /** Solo para quien puede comprar: el último costo y el promedio. */
  costo?: CostoProducto | null;
}

/** Un cliente parecido a lo escrito, con lo que sirve para distinguirlo. */
export interface ClienteOpcion {
  id: string;
  nombre: string;
  telefono: string;
  similitud: number;
  compras: number;
  ultimaCompra: string | null;
}

/** Lo que devuelve cobrar: lo que muestra la tarjeta de la venta en el chat. */
export interface VentaCobrada {
  orderId: string;
  numero: number;
  total: number;
  pago: "efectivo" | "qr" | "tarjeta";
  cliente: string;
  /** "por-confirmar" si algo era a pedido y faltaba: no descontó stock. */
  estado: string;
  unidades: number;
}
