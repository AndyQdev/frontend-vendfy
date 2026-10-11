import type { ReactNode } from "react";
import { CheckCheck, Clock, FileText, Mic, ScanBarcode } from "lucide-react";

import { VendfyMark } from "@/shared/ui/VendfyLogo";
import { cn } from "@/shared/lib/cn";

import { hora, type Mensaje } from "../model/mensaje";

/**
 * Lo que dijo la persona: a la derecha, en cian suave, corto.
 *
 * El doble check dice "esto ya tiene respuesta", como en WhatsApp, que es el
 * chat que este público usa todos los días: no hay que explicarlo. El
 * micrófono dice que fue dictado, para que si la transcripción salió mal se
 * entienda por qué; el código de barras, que lo leyó la pistola.
 */
export function Burbuja({ mensaje: m }: { mensaje: Mensaje }) {
  const respondido = m.fase !== "pensando";

  return (
    <div className="flex justify-end">
      <div
        data-testid="omnibox-burbuja"
        className={cn(
          "animate-in fade-in flex max-w-[88%] items-end gap-3 duration-200 sm:max-w-[62%]",
          "rounded-[14px] border border-primary/15 bg-primary-soft px-3.5 py-2.5",
        )}
      >
        {m.porVoz && <Mic className="mb-0.5 h-4 w-4 shrink-0 text-primary" aria-label="Dictado" />}
        {m.escaneo && <ScanBarcode className="mb-0.5 h-4 w-4 shrink-0 text-primary" aria-label="Escaneado" />}

        {/* La factura que se mandó: la foto misma, que es lo que se reconoce. */}
        {m.adjunto &&
          (m.adjunto.esPdf || !m.adjunto.url ? (
            // Un PDF, o una foto de una conversación guardada que ya no tiene dirección.
            <FileText className="size-8 shrink-0 text-primary" aria-label={m.adjunto.esPdf ? "PDF" : "Archivo"} />
          ) : (
            <a href={m.adjunto.url} target="_blank" rel="noreferrer" className="shrink-0">
              <img
                src={m.adjunto.url}
                alt="Foto de la factura"
                data-testid="omnibox-foto-factura"
                className="h-20 w-16 rounded-md border border-border object-cover sm:h-24 sm:w-20"
              />
            </a>
          ))}

        <p className={cn("text-[13px] leading-snug text-foreground sm:text-sm", !m.texto && "italic text-muted-foreground")}>
          {m.texto ?? "Transcribiendo…"}
        </p>

        <span className="cifra flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
          {hora(m.hora)}
          {respondido ? (
            <CheckCheck className="h-3.5 w-3.5 text-acento" aria-label="Respondido" />
          ) : (
            <Clock className="h-3 w-3" aria-label="Esperando respuesta" />
          )}
        </span>
      </div>
    </div>
  );
}

/**
 * Una respuesta del asistente: su avatar a la izquierda, alineado arriba con
 * la tarjeta. El avatar es la tiendita de Vendfy, no un robot ni un destello:
 * quien responde es "tu tienda".
 */
export function FilaAsistente({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 sm:gap-3">
      <span
        aria-hidden
        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary sm:size-8"
      >
        <VendfyMark variant="mono" size={18} />
      </span>
      <div className="flex min-w-0 flex-1">{children}</div>
    </div>
  );
}
