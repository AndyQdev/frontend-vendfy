import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Loader2, Mic, Send, Square, X } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { usePiloto, type FasePiloto } from "../lib/estado";
import { useConductorPiloto } from "../model/use-piloto";
import { FocoPiloto } from "./FocoPiloto";

const ESTADO: Record<FasePiloto, string> = {
  apagado: "",
  escuchando: "Te escucho",
  pensando: "Entendiendo…",
  trabajando: "Haciéndolo…",
  hablando: "Hablando",
  esperando: "Esperando tu respuesta · F9 para contestar",
  listo: "Listo",
  error: "No se pudo",
};

/** El círculo de Vendfy: cambia según lo que está haciendo. */
function Orbe({ fase, nivel }: { fase: FasePiloto; nivel: React.MutableRefObject<number> }) {
  const anillo = useRef<HTMLSpanElement>(null);
  // Mientras escucha, el anillo crece con la voz que entra (30 veces por segundo).
  useEffect(() => {
    if (fase !== "escuchando") return;
    let cuadro = 0;
    const latir = () => {
      if (anillo.current) anillo.current.style.transform = `scale(${1 + Math.min(1, nivel.current) * 0.45})`;
      cuadro = requestAnimationFrame(latir);
    };
    latir();
    return () => cancelAnimationFrame(cuadro);
  }, [fase, nivel]);

  return (
    <span className="relative grid size-10 flex-none place-items-center">
      {fase === "escuchando" && (
        <>
          <span className="voz-onda absolute inset-0 rounded-full bg-primary/40" />
          <span ref={anillo} className="absolute inset-0 rounded-full bg-primary/25 transition-transform duration-75" />
        </>
      )}
      <span
        className={cn(
          "relative grid size-10 place-items-center rounded-full text-primary-foreground",
          fase === "error" ? "bg-destructive" : fase === "listo" ? "bg-success" : "bg-primary",
        )}
      >
        {fase === "pensando" || fase === "trabajando" ? (
          <Loader2 className="size-4 animate-spin [animation-duration:900ms]" aria-hidden />
        ) : fase === "hablando" ? (
          <span className="flex h-4 items-center gap-[3px]" aria-hidden>
            {[0.9, 0.6, 1.1, 0.75].map((d, i) => (
              <span key={i} className="voz-barra h-4 w-[3px] rounded-full bg-primary-foreground" style={{ animationDuration: `${d}s` }} />
            ))}
          </span>
        ) : (
          <Mic className="size-4" aria-hidden />
        )}
      </span>
    </span>
  );
}

/**
 * "Vendfy": el piloto que maneja el panel hablando. Un botón en todas las
 * pantallas (y F9) abre el micrófono; la tarjeta muestra lo que entendió, lo
 * que dice y lo que pregunta, y la pantalla de atrás se llena sola.
 */
export function PilotoVendfy() {
  const e = usePiloto();
  const { activar, escribir, detener, nivel } = useConductorPiloto();
  const location = useLocation();
  const navigate = useNavigate();
  const [texto, setTexto] = useState("");

  // F9 en cualquier pantalla. Con ref: el conductor cambia en cada dibujo.
  const atajo = useRef(activar);
  atajo.current = activar;
  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key !== "F9" || ev.repeat) return;
      ev.preventDefault();
      atajo.current();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  // En el asistente ya hay un campo para hablar: el botón taparía el suyo.
  const enAsistente = location.pathname.startsWith("/omnibox");
  const ocupado = e.fase === "pensando" || e.fase === "trabajando";

  const enviar = (ev: FormEvent) => {
    ev.preventDefault();
    const t = texto.trim();
    if (!t) return;
    setTexto("");
    void escribir(t);
  };

  return (
    <>
      <FocoPiloto />
      <AnimatePresence>
        {!e.abierto && !enAsistente && (
          <motion.button
            key="lanzador"
            type="button"
            onClick={activar}
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            aria-label="Hablarle a Vendfy (F9)"
            data-testid="piloto-lanzador"
            className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 z-40 flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-3 text-sm font-semibold text-foreground shadow-float transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
              <Mic className="size-4" aria-hidden />
            </span>
            Vendfy
            <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
              F9
            </kbd>
          </motion.button>
        )}

        {e.abierto && (
          <motion.section
            key="tarjeta"
            id="piloto-tarjeta"
            role="dialog"
            aria-label="Vendfy"
            aria-live="polite"
            data-testid="piloto-tarjeta"
            data-fase={e.fase}
            initial={{ y: 24, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-3 text-card-foreground shadow-float"
          >
            <header className="flex items-center gap-3">
              <button
                type="button"
                onClick={activar}
                disabled={ocupado}
                aria-label={e.fase === "escuchando" ? "Ya terminé de hablar" : "Hablar (F9)"}
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
              >
                <Orbe fase={e.fase} nivel={nivel} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-tight">Vendfy</p>
                <p className="truncate text-xs text-muted-foreground" data-testid="piloto-estado">
                  {ESTADO[e.fase]}
                </p>
              </div>
              <button
                type="button"
                onClick={detener}
                aria-label="Cerrar Vendfy"
                className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" aria-hidden />
              </button>
            </header>

            <div className="mt-3 space-y-2">
              {e.dicho && (
                <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground" data-testid="piloto-dicho">
                  <span className="mr-1 text-xs font-semibold uppercase tracking-wide">Tú</span>«{e.dicho}»
                </p>
              )}
              {e.linea && (
                <p className="px-1 text-[15px] font-medium leading-snug text-foreground" data-testid="piloto-linea">
                  {e.linea}
                </p>
              )}
              {e.irAlAsistente && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    detener();
                    navigate("/omnibox");
                  }}
                >
                  Abrir el asistente <ArrowUpRight className="ml-1 size-4" aria-hidden />
                </Button>
              )}
            </div>

            <form onSubmit={enviar} className="mt-3 flex items-center gap-2">
              <input
                value={texto}
                onChange={(ev) => setTexto(ev.target.value)}
                placeholder={e.pregunta ? "Contesta aquí o con F9…" : "Escribe, o pulsa F9 y habla…"}
                aria-label="Escribirle a Vendfy"
                data-testid="piloto-campo"
                className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
              {texto.trim() ? (
                <Button type="submit" size="icon" className="size-9 flex-none" aria-label="Enviar">
                  <Send className="size-4" aria-hidden />
                </Button>
              ) : ocupado || e.fase === "hablando" ? (
                <Button type="button" size="icon" variant="outline" className="size-9 flex-none" onClick={detener} aria-label="Parar">
                  <Square className="size-3.5" aria-hidden />
                </Button>
              ) : (
                <Button type="button" size="icon" variant="outline" className="size-9 flex-none" onClick={activar} aria-label="Hablar (F9)">
                  <Mic className="size-4" aria-hidden />
                </Button>
              )}
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
