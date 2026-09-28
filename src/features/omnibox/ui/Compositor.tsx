import { forwardRef, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowUp, Camera, Loader2, Mic, Paperclip, Square, X } from "lucide-react";

import { cn } from "@/shared/lib/cn";

import type { Dictado } from "../model/use-dictado";
import { CamaraDialog } from "./Camara";

/**
 * El campo de abajo: escribir, dictar, subir una factura y sacarle una foto.
 *
 * Una sola cápsula blanca con borde —no un vidrio flotando—, pegada abajo de
 * la pantalla dentro del mismo scroll de la página (`sticky`, lo pone quien la
 * usa). El pulgar llega sin estirarse y lo último que respondió el sistema
 * queda justo encima.
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
    /** Una foto o un PDF de la factura, del clip o de la cámara. */
    onArchivo: (archivo: File) => void;
    /** Mientras se lee una factura no se manda otra. */
    leyendo: boolean;
  }
>(function Compositor({ texto, onTexto, onEnviar, voz, vozDisponible, consultandoVoz, onArchivo, leyendo }, ref) {
  const grabando = voz.estado === "grabando";
  const procesando = voz.estado === "procesando";
  const hayTexto = texto.trim().length > 0;

  // Dos entradas escondidas: el clip abre archivos (foto o PDF) y, en el
  // teléfono, la cámara abre la cámara del sistema (`capture`). En la compu
  // `capture` no hace nada, así que ahí la cámara es la cámara web en vivo.
  const archivo = useRef<HTMLInputElement>(null);
  const camaraNativa = useRef<HTMLInputElement>(null);
  const [camaraWeb, setCamaraWeb] = useState(false);

  function elegido(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    // Se limpia para que elegir el MISMO archivo otra vez vuelva a disparar.
    e.target.value = "";
    if (f) onArchivo(f);
  }

  function abrirCamara() {
    const tactil = window.matchMedia("(pointer: coarse)").matches;
    if (tactil) camaraNativa.current?.click();
    else setCamaraWeb(true);
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (hayTexto) onEnviar();
  }

  const botonRedondo =
    "grid size-10 shrink-0 place-items-center rounded-full transition-colors sm:size-9 duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45";

  return (
    <div className="space-y-1.5">
      {voz.error && (
        <p role="alert" className="px-3 text-xs font-medium text-destructive">
          {voz.error}
        </p>
      )}

      <form
        onSubmit={enviar}
        className={cn(
          "flex h-12 items-center gap-0.5 rounded-2xl border border-border bg-card pl-1 pr-1 shadow-card sm:h-[52px] sm:gap-1.5 sm:pl-2",
          "transition-[border-color,box-shadow] duration-150 focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15",
          grabando && "border-destructive/50 focus-within:border-destructive/50 focus-within:ring-destructive/15",
        )}
      >
        {grabando ? (
          <>
            <span className="ml-2 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-destructive" />
            {/* Barras que siguen la voz: que se vea que ESCUCHA, no solo que
                el botón cambió de color. */}
            <span className="flex h-5 items-center gap-0.5" aria-hidden>
              {[0.6, 1, 0.8, 1.2, 0.7].map((k, i) => (
                <span
                  key={i}
                  className="w-1 rounded-full bg-destructive/80 transition-[height] duration-75"
                  style={{ height: `${Math.max(15, Math.min(100, voz.nivel * 100 * k))}%` }}
                />
              ))}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-destructive">
              Escuchando… tocá el cuadrado para terminar
            </span>
            <button
              type="button"
              onClick={voz.cancelar}
              aria-label="Descartar el dictado"
              className={cn(botonRedondo, "text-muted-foreground hover:bg-muted hover:text-foreground")}
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              data-testid="omnibox-adjuntar"
              onClick={() => archivo.current?.click()}
              disabled={leyendo}
              aria-label="Subir la foto o el PDF de una factura"
              title="Subir la foto o el PDF de una factura"
              className={cn(botonRedondo, "text-muted-foreground hover:bg-muted hover:text-foreground")}
            >
              {leyendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-[18px] w-[18px]" />}
            </button>
            <input
              ref={ref}
              value={texto}
              onChange={(e) => onTexto(e.target.value)}
              placeholder={procesando ? "Transcribiendo…" : "Escribí o dictá lo que necesitás"}
              aria-label="Qué necesitás"
              disabled={procesando}
              enterKeyHint="send"
              // 16 px en el teléfono: con menos, iOS hace zoom al enfocar.
              className="h-full min-w-0 flex-1 truncate bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-sm"
            />
          </>
        )}

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
            botonRedondo,
            "relative",
            grabando ? "bg-destructive text-destructive-foreground" : "bg-muted text-foreground hover:bg-border",
          )}
        >
          {procesando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : grabando ? (
            <Square className="h-3.5 w-3.5 fill-current" />
          ) : (
            <Mic className="h-[18px] w-[18px]" />
          )}
          {grabando && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-destructive/50"
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
            className={cn(botonRedondo, "bg-primary text-primary-foreground hover:bg-primary-strong")}
          >
            <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </button>
        ) : (
          <button
            type="button"
            data-testid="omnibox-camara"
            onClick={abrirCamara}
            disabled={leyendo || grabando}
            aria-label="Sacarle una foto a una factura"
            title="Sacarle una foto a una factura"
            className={cn(botonRedondo, "bg-muted text-foreground hover:bg-border")}
          >
            <Camera className="h-[18px] w-[18px]" />
          </button>
        )}
      </form>

      <input
        ref={archivo}
        type="file"
        accept="image/*,application/pdf"
        data-testid="omnibox-archivo"
        onChange={elegido}
        className="hidden"
      />
      <input
        ref={camaraNativa}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={elegido}
        className="hidden"
      />
      <CamaraDialog
        abierta={camaraWeb}
        onCerrar={() => setCamaraWeb(false)}
        onFoto={onArchivo}
        onSubirArchivo={() => archivo.current?.click()}
      />
    </div>
  );
});
