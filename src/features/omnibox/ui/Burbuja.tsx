import { CheckCheck, Clock, Mic } from "lucide-react";

import { cn } from "@/shared/lib/cn";

import { hora, type Mensaje } from "../model/mensaje";

/**
 * Lo que dijo la persona, a la derecha, corto.
 *
 * El doble check dice "esto ya tiene respuesta", como en WhatsApp, que es el
 * chat que este público usa todos los días: no hay que explicarlo. El
 * micrófono dice que fue dictado, para que si la transcripción salió mal se
 * entienda por qué.
 */
export function Burbuja({ mensaje: m }: { mensaje: Mensaje }) {
  const respondido = m.fase !== "pensando";

  return (
    <div className="flex justify-end">
      <div
        data-testid="omnibox-burbuja"
        className={cn(
          "animate-in fade-in slide-in-from-bottom-1 flex max-w-[85%] items-end gap-2.5 duration-200",
          "rounded-2xl rounded-br-md border border-ring/40 bg-ring/10 px-3.5 py-2",
        )}
      >
        {m.porVoz && <Mic className="mb-0.5 h-4 w-4 shrink-0 text-ring" aria-label="Dictado" />}

        <p className={cn("text-[15px] leading-snug", !m.texto && "italic text-muted-foreground")}>
          {m.texto ?? "Transcribiendo…"}
        </p>

        <span className="flex shrink-0 items-center gap-1 pb-px text-[11px] text-muted-foreground">
          {hora(m.hora)}
          {respondido ? (
            <CheckCheck className="h-3.5 w-3.5 text-ring" aria-label="Respondido" />
          ) : (
            <Clock className="h-3 w-3" aria-label="Esperando respuesta" />
          )}
        </span>
      </div>
    </div>
  );
}
