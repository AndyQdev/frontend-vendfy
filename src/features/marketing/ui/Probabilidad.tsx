import { cn } from "@/shared/lib/cn";
import type { NivelCompra } from "@/entities/marketing/model/types";

const TONO: Record<NivelCompra, { texto: string; pildora: string; trazo: string; punto: string }> = {
  alta: {
    texto: "Alta",
    pildora: "bg-success-soft text-success-soft-foreground",
    trazo: "stroke-emerald-500",
    punto: "bg-emerald-500",
  },
  media: {
    texto: "Media",
    pildora: "bg-warning-soft text-warning-soft-foreground",
    trazo: "stroke-amber-500",
    punto: "bg-amber-500",
  },
  baja: {
    texto: "Baja",
    pildora: "bg-muted text-muted-foreground",
    trazo: "stroke-slate-400",
    punto: "bg-slate-400",
  },
};

export const pct = (p: number) => `${Math.round(p * 100)} %`;

/** La píldora de la tarjeta del tablero: «72 %» con el color de su nivel. */
export function PildoraProbabilidad({ p, nivel, className }: { p: number; nivel: NivelCompra; className?: string }) {
  const t = TONO[nivel];
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", t.pildora, className)}
      title={`Probabilidad de compra: ${pct(p)} (${t.texto.toLowerCase()})`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", t.punto)} aria-hidden />
      <span className="cifra">{pct(p)}</span>
    </span>
  );
}

/** El medidor grande de la ficha: un anillo que se llena con la probabilidad. */
export function MedidorProbabilidad({ p, nivel }: { p: number; nivel: NivelCompra }) {
  const t = TONO[nivel];
  const r = 34;
  const largo = 2 * Math.PI * r;
  return (
    <div className="relative h-24 w-24 shrink-0" role="img" aria-label={`Probabilidad de compra ${pct(p)}, ${t.texto.toLowerCase()}`}>
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} className="fill-none stroke-muted" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={r}
          className={cn("fill-none transition-[stroke-dashoffset] duration-700", t.trazo)}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={largo}
          strokeDashoffset={largo * (1 - Math.min(Math.max(p, 0), 1))}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="cifra text-xl font-bold leading-none">{Math.round(p * 100)}%</span>
        <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">{t.texto}</span>
      </div>
    </div>
  );
}
