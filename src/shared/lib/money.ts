export const formatMoney = (n: number, currency = "BOB") =>
  new Intl.NumberFormat("es-BO", { style: "currency", currency }).format(n);

const numero = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Dólares como se escriben en Bolivia: "$us 1.234,56" (Intl daría "US$"). */
export const formatDolares = (n: number) => `$us ${numero.format(n)}`;

/** Un monto en la moneda de una compra o un cobro: Bs o dólares. */
export const formatEn = (n: number, moneda: string | null | undefined) =>
  moneda === "USD" ? formatDolares(n) : formatMoney(n);

const cotizacion = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

/** El dólar (Bs por dólar): "11,73", o "11,885" si tiene más decimales. */
export const formatDolar = (n: number) => cotizacion.format(n);

/** Redondea a centavos (lo que se guarda en Bs y en dólares). */
export const centavos = (n: number) => Math.round(n * 100) / 100;
