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
}

const INICIAL: EstadoPiloto = {
  abierto: false,
  fase: "apagado",
  dicho: null,
  linea: null,
  foco: null,
  pregunta: null,
  irAlAsistente: false,
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

let caja: { ficha: number; api: CajaPiloto } | null = null;
let fichas = 0;

/**
 * Con ficha: en desarrollo React monta dos veces y el segundo desmontaje no
 * debe borrar el registro del montaje vigente.
 */
export function registrarCaja(api: CajaPiloto): () => void {
  const ficha = ++fichas;
  caja = { ficha, api };
  return () => {
    if (caja?.ficha === ficha) caja = null;
  };
}

export function cajaPiloto(): CajaPiloto | null {
  return caja?.api ?? null;
}
