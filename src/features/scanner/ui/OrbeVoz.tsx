import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Check, Mic, MicOff } from "lucide-react";

import { ESPERA_MS } from "../model/escucha";
import type { FaseVoz } from "../model/useAltaPorVoz";
import { BarrasVoz } from "./piezas";

/** Lo que dice el orbe a un lector de pantalla y al pasar el mouse. */
const ETIQUETA: Record<FaseVoz, string> = {
  apagada: "Dictar nombre, precio o cantidad",
  preparando: "Preparando el micrófono",
  esperando: "Te escucho. Toca para dejar de escuchar",
  escuchando: "Escuchando. Toca cuando termines",
  procesando: "Entendiendo lo que dijiste",
  escribiendo: "Escribiendo lo que dijiste",
  hablando: "Te estoy preguntando. Toca para hablar ya",
  listo: "Listo",
  "sin-voz": "No te escuché. Toca para hablar",
  error: "No se pudo entender. Toca para intentar de nuevo",
  "sin-permiso": "Sin permiso para usar el micrófono",
  "no-soportada": "Este navegador no permite dictar",
};

/**
 * El orbe de la voz, a la izquierda del parlante del escáner.
 *
 * Una esfera que dice en qué está sin leer nada: gris quieta (apagada), verde
 * que respira con un anillo que se vacía (esperando que hables), verde que
 * crece con tu voz (escuchando), un giro (entendiendo), azul con barras
 * (preguntando), un ✓ (listo) y ámbar con una sacudida (no escuchó).
 */
export function OrbeVoz({
  fase,
  nivel,
  onTocar,
}: {
  fase: FaseVoz;
  nivel: React.MutableRefObject<number>;
  onTocar: () => void;
}) {
  const esfera = useRef<HTMLSpanElement>(null);

  // El nivel de la voz cambia 30 veces por segundo: va directo al estilo, sin
  // pasar por React (re-renderizar el formulario a ese ritmo lo trabaría).
  useEffect(() => {
    if (fase !== "escuchando") {
      esfera.current?.style.setProperty("--nivel", "0");
      return;
    }
    let id = 0;
    const pintar = () => {
      esfera.current?.style.setProperty("--nivel", nivel.current.toFixed(3));
      id = requestAnimationFrame(pintar);
    };
    pintar();
    return () => cancelAnimationFrame(id);
  }, [fase, nivel]);

  const etiqueta = ETIQUETA[fase];
  return (
    <button
      type="button"
      onClick={onTocar}
      aria-label={etiqueta}
      title={etiqueta}
      disabled={fase === "no-soportada"}
      data-testid="orbe-voz"
      data-fase={fase}
      className="relative grid size-8 place-items-center rounded-full transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
    >
      {fase === "esperando" && (
        <svg className="absolute inset-0 -rotate-90 text-success" viewBox="0 0 32 32" aria-hidden>
          <motion.circle
            cx="16"
            cy="16"
            r="14.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            initial={{ pathLength: 1, opacity: 0.7 }}
            animate={{ pathLength: 0, opacity: 0.35 }}
            transition={{ duration: ESPERA_MS / 1000, ease: "linear" }}
          />
        </svg>
      )}
      <span ref={esfera} className="orbe-voz" data-fase={fase} aria-hidden>
        <span className="absolute inset-0 grid place-items-center text-white">
          {fase === "listo" ? (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}>
              <Check className="size-3" strokeWidth={3} />
            </motion.span>
          ) : fase === "hablando" ? (
            <BarrasVoz activa className="h-2.5 gap-[2px] [&>span]:w-[2px]" />
          ) : fase === "sin-permiso" || fase === "no-soportada" ? (
            <MicOff className="size-3 text-muted-foreground" />
          ) : fase === "apagada" || fase === "sin-voz" || fase === "error" ? (
            <Mic className="size-3" />
          ) : null}
        </span>
      </span>
    </button>
  );
}
