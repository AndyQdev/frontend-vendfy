/**
 * El dólar del día. La tienda sigue llevando sus cuentas en Bs: comprar o
 * cobrar en dólares guarda los dólares y el dólar usado, y convierte a Bs.
 */
export type FuenteDolar = "bcb" | "binance";

export interface DolarDelDia {
  /** Bs por dólar. */
  valor: number;
  fuente: FuenteDolar;
  /** YYYY-MM-DD (La Paz). */
  fecha: string;
  /** No es de hoy (fin de semana, feriado o la fuente no respondió). */
  desactualizado: boolean;
  /** La fuente elegida no tenía dato y se usó la otra. */
  otraFuente: boolean;
}

export interface DolarDeLaTienda {
  fuente: FuenteDolar;
  /** Moneda de la tienda: comprar y cobrar en dólares solo aplica en BOB. */
  moneda: string;
  dolar: DolarDelDia | null;
  fuentes: Record<FuenteDolar, { valor: number; fecha: string } | null>;
}

export type Moneda = "BOB" | "USD";

export const NOMBRE_FUENTE: Record<FuenteDolar, string> = {
  bcb: "BCB oficial",
  binance: "Binance (paralelo)",
};
