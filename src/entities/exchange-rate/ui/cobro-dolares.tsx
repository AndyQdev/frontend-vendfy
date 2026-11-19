import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { centavos, formatDolar, formatMoney } from "@/shared/lib/money";
import { leerDolar } from "./dolar";
import type { DolarDelDia } from "../model/types";

/**
 * El dólar de un cobro: el del día o el escrito a mano. Lo da `useDolarElegido`
 * (la Caja) o la venta del asistente, que lo guarda en su borrador.
 */
export interface DolarDelCobro {
  valor: number | null;
  delDia: DolarDelDia | null;
  aMano: boolean;
  cambiar: (n: number) => void;
  volverAlDelDia: () => void;
}

/** "20", "20,50", "" → monto o null. */
export const leerMonto = (v: string): number | null => {
  const t = v.replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? centavos(n) : null;
};

/** Lo que entra en Bs por los dólares que dio el cliente, y el vuelto o lo que falta. */
export function cuentaEnDolares(total: number, dolar: number | null, usd: number | null) {
  const exacto = dolar ? Math.ceil((total / dolar) * 100) / 100 : null;
  const enBs = usd !== null && dolar ? centavos(usd * dolar) : null;
  const diferencia = enBs !== null ? centavos(enBs - total) : null;
  return {
    /** El total en dólares, redondeado para arriba (que no falte un centavo). */
    exacto,
    enBs,
    vuelto: diferencia !== null && diferencia > 0 ? diferencia : 0,
    falta: diferencia !== null && diferencia < 0 ? -diferencia : 0,
  };
}

/** Una cajita con su etiqueta arriba y el número abajo: dos entran en una línea. */
const CAJA =
  "flex min-w-0 flex-col rounded-lg border border-input bg-card px-2.5 py-1 transition-colors focus-within:border-primary";
const NUMERO =
  "cifra w-full min-w-0 bg-transparent text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground/70 md:text-sm";

/**
 * Cobrar en dólares, dentro del resumen de la venta: una línea con el tipo de
 * cambio (se corrige ahí mismo, al que estás vendiendo) y lo que da el
 * cliente. Abajo, solo si hace falta, qué hacer con la diferencia: darle
 * vuelto en Bs o cobrarle el resto en Bs. No se registra como movimiento:
 * la venta queda en su valor en Bs, con los dólares que entraron.
 */
export function FilasDolares({
  total,
  dolar,
  usd,
  onUsd,
}: {
  total: number;
  dolar: DolarDelCobro;
  usd: string;
  onUsd: (v: string) => void;
}) {
  // Mientras se escribe, el texto tal cual; si no, el dólar vigente.
  const [escribiendo, setEscribiendo] = useState<string | null>(null);
  const textoDolar = escribiendo ?? (dolar.valor !== null ? formatDolar(dolar.valor) : "");
  const dio = leerMonto(usd);
  const c = cuentaEnDolares(total, dolar.valor, dio);
  const dolarMalo = (escribiendo !== null && leerDolar(escribiendo) === null) || dolar.valor === null;

  return (
    <div className="space-y-1.5" data-testid="cobro-dolares">
      <div className="grid grid-cols-2 gap-2">
        <label className={cn(CAJA, dolarMalo && "border-warning")}>
          <span className="text-[11px] leading-4 text-muted-foreground">Tipo de cambio</span>
          <span className="flex items-center gap-1">
            <input
              type="text"
              inputMode="decimal"
              aria-label="Tipo de cambio (Bs por dólar)"
              aria-invalid={dolarMalo}
              value={textoDolar}
              placeholder="11,73"
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => {
                setEscribiendo(e.target.value);
                const n = leerDolar(e.target.value);
                if (n !== null) dolar.cambiar(n);
              }}
              onBlur={() => setEscribiendo(null)}
              className={NUMERO}
            />
            {dolar.aMano && dolar.delDia && (
              <button
                type="button"
                onClick={() => {
                  setEscribiendo(null);
                  dolar.volverAlDelDia();
                }}
                title={`Usar el de hoy (${formatDolar(dolar.delDia.valor)})`}
                aria-label={`Usar el tipo de cambio de hoy (${formatDolar(dolar.delDia.valor)})`}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </span>
        </label>
        <label className={CAJA}>
          <span className="text-[11px] leading-4 text-muted-foreground">Recibe $us</span>
          <input
            type="text"
            inputMode="decimal"
            aria-label="Dólares que da el cliente"
            value={usd}
            placeholder={c.exacto !== null ? formatDolar(c.exacto) : "0"}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => onUsd(e.target.value)}
            className={NUMERO}
          />
        </label>
      </div>
      {dio !== null && c.enBs !== null && (c.vuelto > 0 || c.falta > 0) && (
        <p
          className={cn("text-xs font-medium", c.falta > 0 ? "text-warning" : "text-success")}
          data-testid="cobro-dolares-resultado"
        >
          {c.falta > 0 ? (
            <>
              Cobra <span className="cifra font-semibold">{formatMoney(c.falta)}</span> más en efectivo
            </>
          ) : (
            <>
              Dale de vuelto <span className="cifra font-semibold">{formatMoney(c.vuelto)}</span>
            </>
          )}
        </p>
      )}
    </div>
  );
}
