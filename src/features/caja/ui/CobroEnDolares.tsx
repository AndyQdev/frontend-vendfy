import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { centavos, formatDolar, formatDolares, formatMoney } from "@/shared/lib/money";
import { leerDolar, type useDolarElegido } from "@/entities/exchange-rate/ui/dolar";

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

const CAMPO =
  "cifra h-8 rounded-md border border-input bg-card px-2 text-right text-base font-semibold outline-none focus:border-primary aria-[invalid=true]:border-destructive md:text-sm";

/**
 * Cobrar en dólares, dentro del resumen de la venta: dos líneas.
 *
 *   Tipo de cambio [11,73]                  $us 8,53
 *   Recibe $us [10]                Vuelto Bs 17,30
 *
 * El tipo de cambio se corrige ahí mismo (al que estás vendiendo). Si no se
 * escribe cuánto da el cliente, se cobra lo justo en dólares.
 */
export function FilasDolares({
  total,
  dolar,
  usd,
  onUsd,
}: {
  total: number;
  dolar: ReturnType<typeof useDolarElegido>;
  usd: string;
  onUsd: (v: string) => void;
}) {
  // Mientras se escribe, el texto tal cual; si no, el dólar vigente.
  const [escribiendo, setEscribiendo] = useState<string | null>(null);
  const textoDolar = escribiendo ?? (dolar.valor !== null ? formatDolar(dolar.valor) : "");
  const dio = leerMonto(usd);
  const c = cuentaEnDolares(total, dolar.valor, dio);

  return (
    <div className="space-y-1.5" data-testid="cobro-dolares">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Tipo de cambio
          <input
            type="text"
            inputMode="decimal"
            aria-label="Tipo de cambio (Bs por dólar)"
            aria-invalid={escribiendo !== null && leerDolar(escribiendo) === null}
            value={textoDolar}
            placeholder="11,73"
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              setEscribiendo(e.target.value);
              const n = leerDolar(e.target.value);
              if (n !== null) dolar.cambiar(n);
            }}
            onBlur={() => setEscribiendo(null)}
            className={cn(CAMPO, "w-[4.75rem]", dolar.valor === null && "border-warning")}
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
              className="rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </label>
        <span className="cifra text-base font-bold" data-testid="total-dolares">
          {c.exacto !== null ? formatDolares(c.exacto) : "—"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Recibe $us
          <input
            type="text"
            inputMode="decimal"
            aria-label="Dólares que da el cliente"
            value={usd}
            placeholder={c.exacto !== null ? formatDolar(c.exacto) : "0"}
            onChange={(e) => onUsd(e.target.value)}
            className={cn(CAMPO, "w-[5.25rem]")}
          />
        </label>
        {dio !== null && c.enBs !== null && (
          <span
            className={cn("cifra text-xs font-semibold", c.falta > 0 ? "text-warning" : "text-success")}
            data-testid="cobro-dolares-resultado"
          >
            {c.falta > 0 ? `Falta ${formatMoney(c.falta)} en Bs` : `Vuelto ${formatMoney(c.vuelto)}`}
          </span>
        )}
      </div>
    </div>
  );
}
