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
  ms: number;
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
  | "espera-confirmacion"
  | "ambiguedad"
  | "sin-producto"
  | "falta-dato"
  | "sin-entender";

export function estadoDe(p: Propuesta): EstadoTarjeta {
  if (p.resultado) return "resuelta";
  if (!p.intencion) return "sin-entender";
  if (p.opciones.length > 0) return "ambiguedad";
  // Nombró un producto que no existe: no es un dato que falte, y preguntarle
  // "¿qué producto?" a quien acaba de nombrarlo no tiene sentido.
  if (p.noEncontrado) return "sin-producto";
  if (p.faltan.length > 0) return "falta-dato";
  if (p.requiereConfirmacion && p.ejecutable) return "espera-confirmacion";
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
  ajustar_stock: "Guardar ajuste",
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
