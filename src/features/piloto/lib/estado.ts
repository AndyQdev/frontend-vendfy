import { useSyncExternalStore } from "react";

import type { PagoPiloto, PreguntaPiloto } from "../model/respuestas";

/**
 * El estado del piloto ("Oye Vendfy"): qué está haciendo, qué dijo cada uno y
 * qué está señalando en la pantalla. Vive fuera de React para que la Caja y la
 * tarjeta flotante lo lean sin pasarse props (Vendfy no usa Zustand).
 */
export type FasePiloto =
  | "apagado"
  /** Micrófono abierto: lo que digas va al piloto. */
  | "escuchando"
  /** Transcribiendo y entendiendo. */
  | "pensando"
  /** Moviéndose por la pantalla: navega, carga, cobra. */
  | "trabajando"
  | "hablando"
  /** Hizo una pregunta y espera que lo llames otra vez (pasó la ventana). */
  | "esperando"
  | "listo"
  | "error";

export interface EstadoPiloto {
  abierto: boolean;
  fase: FasePiloto;
  /** Lo que entendió que dijiste. */
  dicho: string | null;
  /** Lo que dice Vendfy (también se oye). */
  linea: string | null;
  /** El elemento que señala: valor de `data-piloto` o `cart:<id>` para una fila del carrito. */
  foco: string | null;
  pregunta: PreguntaPiloto | null;
  /** Se entendió algo que se hace en el asistente: el botón para ir. */
  irAlAsistente: boolean;
  /** Lo que va a cambiar, para revisarlo antes del "sí" (el stock de varios, un pedido). */
  tabla: TablaPiloto | null;
}

export interface TablaPiloto {
  titulo: string;
  filas: { nombre: string; antes: string; despues: string }[];
}

const INICIAL: EstadoPiloto = {
  abierto: false,
  fase: "apagado",
  dicho: null,
  linea: null,
  foco: null,
  pregunta: null,
  irAlAsistente: false,
  tabla: null,
};

let estado = INICIAL;
const oyentes = new Set<() => void>();

export function estadoPiloto(): EstadoPiloto {
  return estado;
}

export function setPiloto(cambio: Partial<EstadoPiloto>) {
  estado = { ...estado, ...cambio };
  oyentes.forEach((f) => f());
}

export function cerrarPiloto() {
  estado = INICIAL;
  oyentes.forEach((f) => f());
}

function suscribir(f: () => void) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

export function usePiloto(): EstadoPiloto {
  return useSyncExternalStore(suscribir, estadoPiloto, estadoPiloto);
}

// ─── Lo que la Caja le presta al piloto ─────────────────────────────────────

export type ResultadoCobro =
  | { ok: true; total: number; numero: number; pago: PagoPiloto; vuelto: number | null; falta: number | null }
  | { ok: false; error: string };

/**
 * La Caja, mientras está en pantalla, deja que el piloto toque lo que vive en
 * ella (el método de pago, el cliente) y que cobre como si tocaran el botón.
 * El carrito no hace falta: es la venta en curso, compartida.
 */
export interface CajaPiloto {
  setPago: (pago: PagoPiloto, recibidoUsd?: number | null) => boolean;
  setCliente: (id: string, nombre: string) => void;
  total: () => number;
  cobrar: (pago: PagoPiloto) => Promise<ResultadoCobro>;
}

/** Inventario: el buscador, para que la fila del producto quede a la vista. */
export interface InventarioPiloto {
  buscar: (texto: string) => Promise<void>;
}

export type CampoProducto = "nombre" | "precio" | "stock" | "categoria";

export type ResultadoGuardar = { ok: true } | { ok: false; error: string };

/** El formulario de producto nuevo: el piloto lo llena campo por campo y lo guarda con el "sí". */
export interface ProductoPiloto {
  escribir: (campo: CampoProducto, valor: string | number | { id?: string | null; nombre: string }) => Promise<void>;
  guardar: () => Promise<ResultadoGuardar>;
}

/** Lo que cada pantalla le presta al piloto mientras está montada. */
export interface PantallasPiloto {
  caja: CajaPiloto;
  inventario: InventarioPiloto;
  producto: ProductoPiloto;
}

const registradas: { [K in keyof PantallasPiloto]?: { ficha: number; api: PantallasPiloto[K] } } = {};
let fichas = 0;

/**
 * Con ficha: en desarrollo React monta dos veces y el segundo desmontaje no
 * debe borrar el registro del montaje vigente.
 */
export function registrarPantalla<K extends keyof PantallasPiloto>(clave: K, api: PantallasPiloto[K]): () => void {
  const ficha = ++fichas;
  (registradas as Record<string, unknown>)[clave] = { ficha, api };
  return () => {
    if (registradas[clave]?.ficha === ficha) delete registradas[clave];
  };
}

export function pantallaPiloto<K extends keyof PantallasPiloto>(clave: K): PantallasPiloto[K] | null {
  return (registradas[clave]?.api as PantallasPiloto[K] | undefined) ?? null;
}

export const registrarCaja = (api: CajaPiloto) => registrarPantalla("caja", api);
export const cajaPiloto = () => pantallaPiloto("caja");
