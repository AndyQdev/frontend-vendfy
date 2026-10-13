import { cn } from "@/shared/lib/cn";
import { centavos, formatDolares, formatMoney } from "@/shared/lib/money";
import { LineaDolar, type useDolarElegido } from "@/entities/exchange-rate/ui/dolar";

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

/** Atajos de lo que suele dar el cliente: lo justo y billetes redondos. */
function atajos(exacto: number): number[] {
  const opciones = [exacto, Math.ceil(exacto), Math.ceil(exacto / 5) * 5, Math.ceil(exacto / 10) * 10, Math.ceil(exacto / 20) * 20, Math.ceil(exacto / 50) * 50, Math.ceil(exacto / 100) * 100];
  return [...new Set(opciones.map(centavos))].slice(0, 4);
}

/**
 * Cobrar en dólares: los precios siguen en Bs; el cliente paga con dólares,
 * se ve cuánto es en dólares, cuántos dio y el vuelto en Bs. Si los dólares
 * no alcanzan, el resto se cobra en Bs en efectivo.
 */
export function CobroEnDolares({
  total,
  dolar,
  usd,
  onUsd,
  className,
}: {
  total: number;
  dolar: ReturnType<typeof useDolarElegido>;
  usd: string;
  onUsd: (v: string) => void;
  className?: string;
}) {
  const dio = leerMonto(usd);
  const c = cuentaEnDolares(total, dolar.valor, dio);

  return (
    <div className={cn("space-y-2.5 rounded-lg border border-border bg-card p-3", className)} data-testid="cobro-dolares">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">Total en dólares</span>
        <span className="cifra text-lg font-bold">{c.exacto !== null ? formatDolares(c.exacto) : "—"}</span>
      </div>
      <LineaDolar
        valor={dolar.valor}
        delDia={dolar.delDia}
        aMano={dolar.aMano}
        onCambio={dolar.cambiar}
        onVolver={dolar.volverAlDelDia}
        className="text-xs"
      />
      <label className="block space-y-1">
        <span className="text-xs font-medium">¿Cuántos dólares te da?</span>
        <span className="relative block">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$us</span>
          <input
            type="text"
            inputMode="decimal"
            aria-label="Dólares que da el cliente"
            value={usd}
            onChange={(e) => onUsd(e.target.value)}
            placeholder={c.exacto !== null ? String(c.exacto).replace(".", ",") : "0"}
            className="cifra h-10 w-full rounded-lg border border-input bg-card pl-10 pr-3 text-base font-semibold outline-none focus:border-primary md:text-sm"
          />
        </span>
      </label>
      {c.exacto !== null && (
        <div className="flex flex-wrap gap-1.5">
          {atajos(c.exacto).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onUsd(String(m))}
              className={cn(
                "cifra rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                dio === m ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border hover:border-primary/40",
              )}
            >
              {formatDolares(m)}
            </button>
          ))}
        </div>
      )}
      {dio !== null && c.enBs !== null && (
        <p
          className={cn("flex items-baseline justify-between text-sm", c.falta > 0 && "text-warning")}
          data-testid="cobro-dolares-resultado"
        >
          {c.falta > 0 ? (
            <>
              <span>Falta, en efectivo</span>
              <span className="cifra font-bold">{formatMoney(c.falta)}</span>
            </>
          ) : (
            <>
              <span>Vuelto</span>
              <span className="cifra font-bold text-success">{formatMoney(c.vuelto)}</span>
            </>
          )}
        </p>
      )}
    </div>
  );
}
