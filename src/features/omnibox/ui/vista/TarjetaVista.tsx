import { BarChart3, PanelRight } from "lucide-react";

import type { Propuesta } from "@/entities/omnibox/model/types";

import { resumenPiezas } from "../../model/vistas";
import { BotonSecundario, Tarjeta } from "../piezas";

/**
 * La respuesta a una pregunta de análisis, en el chat. La respuesta de
 * verdad es la vista del panel; acá queda qué se armó y el botón para
 * volver a abrirla (en el teléfono, o después de mirar otra cosa).
 */
export function TarjetaVista({
  propuesta,
  hora,
  abierta,
  onAbrir,
}: {
  propuesta: Propuesta;
  hora: string;
  /** Esta vista es la que está a la vista en el panel. */
  abierta: boolean;
  onAbrir: () => void;
}) {
  const vista = propuesta.vista!;
  return (
    <Tarjeta estado="vista" hora={hora}>
      <div data-testid="tarjeta-vista" className="flex items-start gap-3 pr-12">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
          <BarChart3 className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{vista.titulo}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{resumenPiezas(vista).join(" · ")}</p>
        </div>
      </div>
      {propuesta.aviso ? (
        <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-soft-foreground">{propuesta.aviso}</p>
      ) : null}
      <div className="mt-3 sm:pl-[3.25rem]">
        {abierta ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <PanelRight className="size-3.5" />
            Abierto en el panel
          </p>
        ) : (
          <BotonSecundario data-testid="vista-abrir" onClick={onAbrir} className="w-full sm:w-auto">
            <BarChart3 />
            Ver análisis
          </BotonSecundario>
        )}
      </div>
    </Tarjeta>
  );
}
