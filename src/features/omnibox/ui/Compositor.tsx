import { forwardRef, type FormEvent } from "react";
import { ArrowUp, Camera, Loader2, Mic, Search, Square, X } from "lucide-react";

import { useIsMobile } from "@/shared/hooks/use-mobile";
import { cn } from "@/shared/lib/cn";

import type { Dictado } from "../model/use-dictado";

/**
 * El campo de abajo: escribir, dictar, (pronto) foto.
 *
 * Fijo abajo como en cualquier chat: el pulgar llega sin estirarse y lo último
 * que respondió el sistema queda justo encima.
 *
 * El botón de enviar aparece solo cuando hay texto y ocupa el lugar de la
 * cámara. Vacío no sirve para nada, y en el teléfono cada botón de más achica
 * el campo donde se escribe.
 */
export const Compositor = forwardRef<
  HTMLInputElement,
  {
    texto: string;
    onTexto: (t: string) => void;
    onEnviar: () => void;
    voz: Dictado;
    vozDisponible: boolean;
    consultandoVoz: boolean;
  }
>(function Compositor({ texto, onTexto, onEnviar, voz, vozDisponible, consultandoVoz }, ref) {
  const grabando = voz.estado === "grabando";
  const procesando = voz.estado === "procesando";
  const hayTexto = texto.trim().length > 0;
  // El largo no entra a 390 px con los dos botones redondos al lado, y cortado
  // ("…lo que ne") se ve roto.
  const movil = useIsMobile();

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (hayTexto) onEnviar();
  }

  return (
    <div className="shrink-0 space-y-1.5 pt-3">
      {voz.error && (
        <p role="alert" className="px-3 text-xs font-medium text-red-700 dark:text-red-400">
          {voz.error}
        </p>
      )}

      <form onSubmit={enviar} className="glass flex items-center gap-2 rounded-[26px] p-2">
        <div
          className={cn(
            "glass-field flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full px-4",
            grabando && "ring-1 ring-red-500/50",
          )}
        >
          {grabando ? (
            <>
              <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
              {/* Barras que siguen la voz: que se vea que ESCUCHA, no solo que
                  el botón cambió de color. */}
              <span className="flex h-5 items-center gap-0.5" aria-hidden>
                {[0.6, 1, 0.8, 1.2, 0.7].map((k, i) => (
                  <span
                    key={i}
                    className="w-1 rounded-full bg-red-500/80 transition-[height] duration-75"
                    style={{ height: `${Math.max(15, Math.min(100, voz.nivel * 100 * k))}%` }}
                  />
                ))}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-red-700 dark:text-red-400">
                Escuchando… tocá el cuadrado para terminar
              </span>
              <button
                type="button"
                onClick={voz.cancelar}
                aria-label="Descartar el dictado"
                className="press rounded-full p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
              <input
                ref={ref}
                value={texto}
                onChange={(e) => onTexto(e.target.value)}
                placeholder={
                  procesando
                    ? "Transcribiendo…"
                    : movil
                      ? "Escribí o dictá…"
                      : "Escribí o dictá lo que necesitás"
                }
                aria-label="Qué necesitás"
                disabled={procesando}
                enterKeyHint="send"
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
              />
            </>
          )}
        </div>

        <button
          type="button"
          onClick={voz.alternar}
          aria-label={grabando ? "Detener el dictado" : "Dictar"}
          disabled={!voz.soportado || !vozDisponible || procesando}
          title={
            !voz.soportado
              ? "Tu navegador no puede grabar audio"
              : consultandoVoz
                ? "Preparando el dictado…"
                : !vozDisponible
                  ? "El dictado no está configurado en el servidor"
                  : grabando
                    ? "Tocá para terminar"
                    : "Dictar"
          }
          className={cn(
            "press relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors",
            "disabled:pointer-events-none disabled:opacity-50",
            grabando ? "bg-red-500 text-white" : "glass-chip text-foreground",
          )}
        >
          {procesando ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : grabando ? (
            <Square className="h-4 w-4 fill-current" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
          {grabando && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-red-500/60"
              style={{ transform: `scale(${1 + voz.nivel * 0.35})` }}
            />
          )}
        </button>

        {/* Sin este submit, en el teléfono no hay forma de mandar: no hay
            Enter a mano. */}
        {hayTexto && !grabando ? (
          <button
            type="submit"
            aria-label="Enviar"
            className="press flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ring text-slate-950 shadow-[var(--cta-shadow)]"
          >
            <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
          </button>
        ) : (
          <button
            type="button"
            disabled
            aria-label="Sacar una foto"
            title="Pronto: cargar desde una foto"
            className="glass-chip flex h-12 w-12 shrink-0 items-center justify-center rounded-full opacity-60"
          >
            <Camera className="h-5 w-5" />
          </button>
        )}
      </form>
    </div>
  );
});
