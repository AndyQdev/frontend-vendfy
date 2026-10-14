import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Check, Loader2, Mic, MicOff, Sparkles, Volume2 } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { ESPERA_MS } from "../model/escucha";
import type { FaseVoz } from "../model/useAltaPorVoz";

/** Lo que dice la cápsula (en pantallas chicas solo se ven el ícono y las barras). */
const TEXTO: Record<FaseVoz, string> = {
  apagada: "Hablar",
  preparando: "Preparando…",
  esperando: "Te escucho",
  escuchando: "Escuchando…",
  procesando: "Pensando…",
  escribiendo: "Escribiendo…",
  hablando: "Hablando…",
  listo: "Listo",
  "sin-voz": "Toca para hablar",
  error: "Reintentar",
  "sin-permiso": "Sin micrófono",
  "no-soportada": "Sin voz",
};

const AYUDA: Partial<Record<FaseVoz, string>> = {
  apagada: "Toca para dictar nombre, precio o cantidad",
  esperando: "Habla cuando quieras. Toca para dejar de escuchar",
  escuchando: "Toca cuando termines de hablar",
  hablando: "Toca para hablar sin esperar",
  "sin-permiso": "Permite el micrófono en el candado de la barra de direcciones",
  "no-soportada": "Este navegador no permite dictar",
};

/** Colores de la cápsula por fase (fondo, borde y texto). */
const ESTILO: Record<FaseVoz, string> = {
  apagada: "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
  preparando: "border-border bg-card text-muted-foreground",
  esperando: "border-success/50 bg-success-soft text-success-soft-foreground",
  escuchando: "border-success bg-success text-white shadow-[0_0_0_4px_hsl(var(--success)/0.2),0_6px_20px_-4px_hsl(var(--success)/0.6)]",
  procesando: "voz-pensando border-primary/40 text-primary",
  escribiendo: "border-primary bg-primary text-primary-foreground shadow-[0_6px_20px_-4px_hsl(var(--primary)/0.55)]",
  hablando: "border-primary/40 bg-primary-soft text-primary-soft-foreground",
  listo: "border-success bg-success text-white",
  "sin-voz": "border-warning/50 bg-warning-soft text-warning-soft-foreground",
  error: "border-warning/50 bg-warning-soft text-warning-soft-foreground",
  "sin-permiso": "border-border bg-muted text-muted-foreground",
  "no-soportada": "border-border bg-muted text-muted-foreground",
};

/** Alturas de reposo de cada barra: una onda, no un bloque. */
const BASE = [0.35, 0.6, 0.9, 0.6, 0.35];
/** Hablando, cada barra con su propio ritmo: parejas se ven mecánicas. */
const RITMO_HABLA = [1.05, 0.85, 1.2, 0.95, 1.1];

/**
 * Las barras de la voz. Escuchando, siguen el nivel de lo que entra por el
 * micrófono (se escriben directo en el estilo: 30 veces por segundo por
 * React trabaría el formulario). En las demás fases, una onda propia.
 */
function Barras({ fase, nivel }: { fase: FaseVoz; nivel: React.MutableRefObject<number> }) {
  const barras = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    if (fase !== "escuchando" && fase !== "esperando") return;
    let id = 0;
    const inicio = performance.now();
    const pintar = (t: number) => {
      const n = fase === "escuchando" ? nivel.current : 0;
      barras.current.forEach((b, i) => {
        if (!b) return;
        // Con voz, cada barra salta distinto; sin voz, una respiración suave.
        const ola = Math.sin((t - inicio) / 180 + i * 1.1) * 0.5 + 0.5;
        const alto = fase === "escuchando" ? 0.25 + Math.min(1, n * 1.6) * (0.5 + ola * 0.5) * BASE[i] * 1.4 : 0.22 + ola * 0.18 * BASE[i];
        b.style.transform = `scaleY(${Math.min(1, alto).toFixed(3)})`;
      });
      id = requestAnimationFrame(pintar);
    };
    id = requestAnimationFrame(pintar);
    return () => cancelAnimationFrame(id);
  }, [fase, nivel]);

  const habla = fase === "hablando";
  const piensa = fase === "procesando";
  return (
    <span aria-hidden className="flex h-5 items-center gap-[3px]">
      {BASE.map((h, i) => (
        <span
          key={i}
          ref={(el) => {
            barras.current[i] = el;
          }}
          className={cn(
            "h-full w-[3px] origin-center rounded-full bg-current transition-transform duration-75",
            habla && "voz-barra",
            piensa && "voz-pensar-barra",
          )}
          style={{
            transform: `scaleY(${habla || piensa ? h : fase === "listo" ? 0.5 : 0.25})`,
            ...(habla ? { animationDuration: `${RITMO_HABLA[i]}s`, animationDelay: `${i * 130}ms` } : {}),
            // Pensando: una ola que va de izquierda a derecha.
            ...(piensa ? { animationDelay: `${i * 180}ms` } : {}),
          }}
        />
      ))}
    </span>
  );
}

/**
 * Cápsula de la voz junto al parlante: ícono, barras y qué está pasando
 * ("Te escucho", "Escuchando…", "Pensando…"). Se toca para hablar, para
 * avisar que ya terminó o para dejar de escuchar.
 */
export function IndicadorVoz({
  fase,
  nivel,
  onTocar,
}: {
  fase: FaseVoz;
  nivel: React.MutableRefObject<number>;
  onTocar: () => void;
}) {
  const icono =
    fase === "listo" ? (
      <Check className="size-3.5" strokeWidth={3} />
    ) : fase === "procesando" ? (
      <Sparkles className="voz-pensar-icono size-3.5" />
    ) : fase === "preparando" ? (
      <Loader2 className="size-3.5 animate-spin" />
    ) : fase === "escribiendo" ? (
      <Sparkles className="size-3.5" />
    ) : fase === "hablando" ? (
      <Volume2 className="size-3.5" />
    ) : fase === "sin-permiso" || fase === "no-soportada" ? (
      <MicOff className="size-3.5" />
    ) : (
      <Mic className="size-3.5" />
    );

  return (
    <motion.button
      type="button"
      layout
      onClick={onTocar}
      disabled={fase === "no-soportada"}
      aria-label={AYUDA[fase] ?? TEXTO[fase]}
      title={AYUDA[fase] ?? TEXTO[fase]}
      data-testid="orbe-voz"
      data-fase={fase}
      className={cn(
        "relative flex h-9 items-center gap-2 overflow-hidden rounded-full border-2 pl-1 pr-3 text-[13px] font-semibold transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        ESTILO[fase],
      )}
    >
      <span
        className={cn(
          "relative grid size-7 shrink-0 place-items-center rounded-full",
          fase === "esperando" ? "bg-success text-white" : fase === "escuchando" ? "bg-white/25" : undefined,
        )}
      >
        {fase === "esperando" && <span className="voz-onda absolute inset-0 rounded-full bg-success" aria-hidden />}
        <span className="relative">{icono}</span>
      </span>
      <Barras fase={fase} nivel={nivel} />
      <span className="hidden whitespace-nowrap sm:inline">{TEXTO[fase]}</span>
      {fase === "esperando" && (
        // Cuánto queda de la espera: una línea que se vacía.
        <motion.span
          aria-hidden
          className="absolute inset-x-3 bottom-0 h-[2px] origin-left rounded-full bg-success"
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: ESPERA_MS / 1000, ease: "linear" }}
        />
      )}
    </motion.button>
  );
}
