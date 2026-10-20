import { centavos, formatDolar, formatDolares, formatMoney } from "@/shared/lib/money";

/**
 * El nombre de cada método de pago. La Caja guarda "cash/qr/card/usd" y el
 * asistente "efectivo/qr/tarjeta": se muestran igual.
 */
const NOMBRES: Record<string, string> = {
  cash: "Efectivo",
  efectivo: "Efectivo",
  qr: "QR",
  card: "Tarjeta",
  tarjeta: "Tarjeta",
  transfer: "Transferencia",
  transferencia: "Transferencia",
  usd: "Dólares",
  dolares: "Dólares",
};

export function nombrePago(metodo: string | null | undefined): string {
  if (!metodo) return "Sin definir";
  const n = NOMBRES[metodo.toLowerCase()];
  return n ?? metodo.charAt(0).toUpperCase() + metodo.slice(1);
}

/**
 * Una venta cobrada en dólares, en una línea:
 * "$us 20,00 al dólar de 11,73 · vuelto Bs 84,60". null si no fue en dólares.
 */
export function cobroEnDolaresTexto(o: {
  paymentMethod?: string | null;
  usdReceived?: number | string | null;
  exchangeRate?: number | string | null;
  totalAmount: number | string;
}): string | null {
  if (o.paymentMethod !== "usd" || o.usdReceived == null || o.exchangeRate == null) return null;
  const usd = Number(o.usdReceived);
  const dolar = Number(o.exchangeRate);
  const diferencia = centavos(usd * dolar - Number(o.totalAmount));
  const resto =
    diferencia > 0
      ? ` · vuelto ${formatMoney(diferencia)}`
      : diferencia < 0
        ? ` · más ${formatMoney(-diferencia)} en efectivo`
        : "";
  return `${formatDolares(usd)} al dólar de ${formatDolar(dolar)}${resto}`;
}
