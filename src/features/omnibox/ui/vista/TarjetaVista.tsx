import { BarChart3, PanelRight, Pin } from "lucide-react";

import type { Propuesta } from "@/entities/omnibox/model/types";
import { useConclusionVista } from "@/entities/omnibox/api";
import { Skeleton } from "@/shared/ui/skeleton";

import { resumenPiezas } from "../../model/vistas";
import { BotonSecundario, Tarjeta } from "../piezas";
import { ChipsAlcance } from "./Alcance";

/**
 * La respuesta a una pregunta de análisis, en el chat.
 *
 * Primero lo que CONTESTA, escrito (la conclusión verificada: solo cifras que
 * están en los datos), como en cualquier chat; debajo, la tarjeta con de
 * quién son los números y el botón para ver el análisis. Antes la respuesta
 * quedaba escondida al final del panel y había que interpretar la vista.
 */
export function TarjetaVista({
  propuesta,
  hora,
  abierta,
  onAbrir,
  storeId,
  pregunta,
}: {
  propuesta: Propuesta;
  hora: string;
  /** Esta vista es la que está a la vista en el panel. */
  abierta: boolean;
  onAbrir: () => void;
  storeId: string;
  /** La misma que usa el panel: así la conclusión se pide una sola vez. */
  pregunta: string;
}) {
  const vista = propuesta.vista!;
  const e = propuesta.entidades as { cambios?: string[]; fijada?: string };
  const respuesta = useConclusionVista(storeId, pregunta, vista);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      {respuesta.isLoading ? (
        <div data-testid="vista-respuesta" data-estado="cargando" aria-busy className="space-y-1.5 px-1 py-1">
          <span className="sr-only">Leyendo los números…</span>
          <Skeleton className="h-3.5 w-full max-w-md" />
          <Skeleton className="h-3.5 w-4/5 max-w-sm" />
        </div>
      ) : respuesta.data ? (
        <p data-testid="vista-respuesta" data-estado="lista" className="px-1 text-[15px] leading-relaxed text-foreground">
          {respuesta.data}
        </p>
      ) : null}

      <Tarjeta estado="vista" hora={hora}>
        <div data-testid="tarjeta-vista" className="flex items-start gap-3 pr-12">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
            <BarChart3 className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{vista.titulo}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {e.fijada ? (
                <span className="mr-1 inline-flex items-center gap-1 font-medium text-primary">
                  <Pin className="size-3" />
                  De tu tablero ·
                </span>
              ) : null}
              {resumenPiezas(vista).join(" · ")}
            </p>
            <ChipsAlcance filtros={vista.filtros} condiciones={vista.condiciones} className="mt-1.5" />
          </div>
        </div>
        {e.cambios ? (
          // "Ahora por categoría": lo que cambió, calculado comparando las dos vistas.
          <ul data-testid="vista-cambios" className="mt-2 space-y-0.5 text-[13px] text-foreground sm:pl-[3.25rem]">
            {e.cambios.length === 0 ? (
              <li className="text-muted-foreground">La vista quedó igual.</li>
            ) : (
              e.cambios.map((c) => <li key={c}>{c}</li>)
            )}
          </ul>
        ) : null}
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
    </div>
  );
}
