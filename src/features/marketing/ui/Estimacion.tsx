import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { bs, type Embudo, type Estimacion } from "@/entities/marketing/model/types";

/**
 * La estimación de una campaña: siempre como rango y con sus supuestos a la
 * vista. Es una estimación, no una promesa.
 */
export function RangoEstimado({ e, compacto = false, moneda = "BOB" }: { e: Estimacion; compacto?: boolean; moneda?: string }) {
  const [abierto, setAbierto] = useState(false);
  const r = e.ingreso;
  return (
    <div className="space-y-2">
      <dl className={cn("grid gap-2", compacto ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
        <Dato etiqueta="Inversión" valor={bs(e.inversion, moneda)} />
        <Dato etiqueta="Podría volver" valor={`${bs(r.min, moneda)} – ${bs(r.max, moneda)}`} destacado />
        {!compacto && e.conversaciones && (
          <Dato etiqueta="Escribirían" valor={`${e.conversaciones.min} – ${e.conversaciones.max}`} />
        )}
        {!compacto && <Dato etiqueta="Ventas" valor={`${e.ventas.min} – ${e.ventas.max}`} />}
      </dl>
      {e.ganancia && !compacto && (
        <p className="text-xs text-muted-foreground">
          Ganancia después de pagar la campaña: {bs(e.ganancia.min, moneda)} a {bs(e.ganancia.max, moneda)}
          {e.roasEquilibrio ? ` · por debajo de ${e.roasEquilibrio}× de retorno se pierde plata` : ""}
        </p>
      )}
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="inline-flex items-center gap-1 rounded text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Info className="h-3.5 w-3.5" /> De dónde salen estos números
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", abierto && "rotate-180")} />
      </button>
      {abierto && (
        <ul className="space-y-1 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
          {e.supuestos.map((s) => (
            <li key={s}>· {s}</li>
          ))}
          <li className="pt-1 font-medium text-foreground/80">
            Es una estimación, no una promesa: se afina sola con los resultados de tus campañas.
          </li>
        </ul>
      )}
    </div>
  );
}

function Dato({ etiqueta, valor, destacado }: { etiqueta: string; valor: string; destacado?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <dt className="etiqueta text-muted-foreground">{etiqueta}</dt>
      <dd className={cn("cifra mt-0.5 text-sm font-semibold", destacado && "text-primary")}>{valor}</dd>
    </div>
  );
}

const PASOS: Array<{ clave: keyof Embudo["etapas"]; titulo: string }> = [
  { clave: "nuevo", titulo: "Escribieron" },
  { clave: "conversando", titulo: "Les respondimos" },
  { clave: "cotizado", titulo: "Cotizaron" },
  { clave: "pidio", titulo: "Pidieron" },
  { clave: "compro", titulo: "Compraron" },
];

/** El camino de las personas: cuántas llegaron hasta cada paso. */
export function EmbudoBarras({ embudo }: { embudo: Embudo }) {
  const total = Math.max(embudo.personas, 1);
  return (
    <ol className="space-y-2" aria-label="Embudo de los chats">
      {PASOS.map((p) => {
        const n = embudo.etapas[p.clave] ?? 0;
        const pct = Math.round((n / total) * 100);
        return (
          <li key={p.clave} className="grid grid-cols-[7.5rem_1fr_4.5rem] items-center gap-3 text-sm">
            <span className="text-muted-foreground">{p.titulo}</span>
            <span className="h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(pct, n ? 2 : 0)}%` }} />
            </span>
            <span className="cifra text-right">
              {n} <span className="text-xs text-muted-foreground">{embudo.personas ? `${pct} %` : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
