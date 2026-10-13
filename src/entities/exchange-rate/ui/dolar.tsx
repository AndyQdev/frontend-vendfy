import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Pencil, RotateCcw } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { formatDolar } from "@/shared/lib/money";
import { useDolar } from "../api";
import { NOMBRE_FUENTE, type DolarDelDia, type FuenteDolar, type Moneda } from "../model/types";

/** Más lejos que esto del dólar del día, se avisa (sin bloquear). */
const LEJOS = 0.1;

const hoyEnLaPaz = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/La_Paz" });

/** "11,73", "11.73", "" → número o null. */
export const leerDolar = (v: string): number | null => {
  const t = v.replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 1 && n <= 100 ? n : null;
};

/**
 * El dólar de una compra o un cobro: el del día de la tienda hasta que lo
 * cambien a mano (pagaste a otro precio).
 */
export function useDolarElegido(storeId: string | undefined, inicial?: number | null) {
  const consulta = useDolar(storeId);
  const [manual, setManual] = useState<number | null>(inicial ?? null);
  const delDia = consulta.data?.dolar ?? null;
  return {
    /** El dólar que se usa: el escrito a mano o el del día. */
    valor: manual ?? delDia?.valor ?? null,
    delDia,
    aMano: manual !== null && manual !== delDia?.valor,
    cambiar: setManual,
    volverAlDelDia: () => setManual(null),
    /** Comprar/cobrar en dólares solo aplica a tiendas en Bs. */
    disponible: (consulta.data?.moneda ?? "BOB") === "BOB",
    cargando: consulta.isLoading,
  };
}

/** De dónde sale el dólar: "BCB oficial · hoy", "Binance (paralelo) · del 10/10". */
export function origenDolar(d: DolarDelDia): string {
  const cuando =
    d.fecha === hoyEnLaPaz() ? "hoy" : `del ${d.fecha.slice(8, 10)}/${d.fecha.slice(5, 7)}`;
  return `${NOMBRE_FUENTE[d.fuente]} · ${cuando}${d.otraFuente ? " (la de siempre no respondió)" : ""}`;
}

/** Bs | $us, la moneda de una compra. */
export function SelectorMoneda({
  valor,
  onCambio,
  etiqueta = "Moneda",
  className,
}: {
  valor: Moneda;
  onCambio: (m: Moneda) => void;
  etiqueta?: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={etiqueta}
      className={cn("inline-flex rounded-lg border border-border bg-muted/40 p-1", className)}
    >
      {(["BOB", "USD"] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={valor === m}
          onClick={() => onCambio(m)}
          className={cn(
            "min-w-[3.25rem] rounded-md px-3 py-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            valor === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {m === "BOB" ? "Bs" : "$us"}
        </button>
      ))}
    </div>
  );
}

/**
 * "$us 1 = Bs 11,73 · BCB oficial · hoy  Cambiar". Tocando Cambiar se escribe
 * otro (pagaste a otro precio); si queda lejos del del día, avisa.
 */
export function LineaDolar({
  valor,
  delDia,
  aMano,
  onCambio,
  onVolver,
  etiquetaAMano = "a mano",
  className,
}: {
  valor: number | null;
  delDia: DolarDelDia | null;
  aMano: boolean;
  onCambio: (n: number) => void;
  onVolver: () => void;
  /** Qué se dice cuando no es el del día ("a mano", "el de cuando se registró"). */
  etiquetaAMano?: string;
  className?: string;
}) {
  const sinDolar = valor === null;
  const [editando, setEditando] = useState(sinDolar);
  const [texto, setTexto] = useState(valor !== null ? String(valor) : "");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sinDolar) setEditando(true);
  }, [sinDolar]);
  useEffect(() => {
    if (editando) input.current?.focus();
  }, [editando]);

  const lejos = valor !== null && delDia !== null && Math.abs(valor / delDia.valor - 1) > LEJOS;
  const leido = leerDolar(texto);

  const confirmar = () => {
    if (leido === null) return;
    onCambio(leido);
    setEditando(false);
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm", className)} data-testid="linea-dolar">
      {editando ? (
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">$us 1 = Bs</span>
          <input
            ref={input}
            type="text"
            inputMode="decimal"
            aria-label="Dólar (Bs por dólar)"
            aria-invalid={texto !== "" && leido === null}
            placeholder={delDia ? formatDolar(delDia.valor) : "11,73"}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={confirmar}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmar();
              }
              if (e.key === "Escape" && !sinDolar) setEditando(false);
            }}
            className="cifra h-8 w-24 rounded-md border border-input bg-card px-2 text-base font-semibold outline-none focus:border-primary aria-[invalid=true]:border-destructive md:text-sm"
          />
          {sinDolar && <span className="text-xs text-warning">No se pudo traer el dólar de hoy: escribilo</span>}
        </label>
      ) : (
        <>
          <span>
            <span className="text-muted-foreground">$us 1 = </span>
            <span className="cifra font-semibold">Bs {formatDolar(valor!)}</span>
          </span>
          <span className="text-xs text-muted-foreground">
            · {aMano || !delDia ? etiquetaAMano : origenDolar(delDia)}
          </span>
          <button
            type="button"
            onClick={() => {
              setTexto(valor !== null ? String(valor) : "");
              setEditando(true);
            }}
            className="inline-flex items-center gap-1 rounded px-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Pencil className="h-3 w-3" aria-hidden />
            Cambiar
          </button>
          {aMano && delDia && (
            <button
              type="button"
              onClick={onVolver}
              className="inline-flex items-center gap-1 rounded px-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              Usar el de hoy ({formatDolar(delDia.valor)})
            </button>
          )}
        </>
      )}
      {lejos && !editando && (
        <span className="flex w-full items-center gap-1 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          Está lejos del dólar de hoy (Bs {formatDolar(delDia!.valor)}). Revisalo antes de guardar.
        </span>
      )}
    </div>
  );
}

/**
 * Configuración: de dónde sale el dólar de la tienda. Muestra cuánto dice
 * cada fuente hoy, para que se vea la diferencia antes de elegir.
 */
export function ElegirFuenteDolar({
  storeId,
  valor,
  onCambio,
}: {
  storeId: string | undefined;
  valor: FuenteDolar;
  onCambio: (f: FuenteDolar) => void;
}) {
  const { data } = useDolar(storeId);
  const opciones: { id: FuenteDolar; detalle: string }[] = [
    { id: "bcb", detalle: "El tipo de cambio oficial del Banco Central. Es el que piden las facturas." },
    { id: "binance", detalle: "El paralelo, de los anuncios de USDT en Binance P2P." },
  ];
  return (
    <div role="radiogroup" aria-label="De dónde sale el dólar" className="grid gap-2 sm:grid-cols-2">
      {opciones.map((o) => {
        const hoy = data?.fuentes?.[o.id];
        const elegida = valor === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={elegida}
            onClick={() => onCambio(o.id)}
            className={cn(
              "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              elegida ? "border-primary bg-primary-soft" : "border-border hover:border-border-strong",
            )}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span className="text-sm font-semibold">{NOMBRE_FUENTE[o.id]}</span>
              {hoy && <span className="cifra text-sm font-semibold">Bs {formatDolar(hoy.valor)}</span>}
            </span>
            <span className="text-xs text-muted-foreground">{o.detalle}</span>
          </button>
        );
      })}
    </div>
  );
}
