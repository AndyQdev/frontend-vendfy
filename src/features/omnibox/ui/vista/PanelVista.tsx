import type { Dispatch } from "react";
import { CalendarRange } from "lucide-react";

import type { Periodo } from "@/entities/omnibox/model/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { cn } from "@/shared/lib/cn";

import type { AccionMesa, Analisis } from "../../model/mesa";
import { PERIODOS, periodoComun } from "../../model/vistas";
import { PiezaConclusion, PiezaConDatos } from "./Piezas";

/**
 * El análisis en el panel: arriba el período (cambia todas las piezas a la
 * vez, para que los números siempre cuadren entre sí), abajo las piezas en
 * el orden que las eligió la IA.
 *
 * Ampliado, los gráficos van de a dos; los indicadores y la conclusión
 * siempre ocupan todo el ancho.
 */
export function PanelVista({
  analisis,
  storeId,
  despachar,
  ampliada,
}: {
  analisis: Analisis;
  storeId: string;
  despachar: Dispatch<AccionMesa>;
  ampliada: boolean;
}) {
  const { vista, pregunta } = analisis;
  const periodo = periodoComun(vista);

  return (
    <div data-testid="omnibox-vista" className="space-y-3 p-3 sm:p-4">
      {periodo ? (
        <div className="flex items-center gap-2">
          <CalendarRange className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <Select value={periodo} onValueChange={(v) => despachar({ tipo: "periodoAnalisis", periodo: v as Periodo })}>
            <SelectTrigger data-testid="vista-periodo" aria-label="Período" className="h-9 w-auto min-w-[11rem] gap-2 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODOS.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-[13px]">
                  {p.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className={cn("grid gap-3", ampliada && "xl:grid-cols-2")}>
        {vista.piezas.map((pieza, i) => (
          <div
            key={pieza.id}
            className={cn(
              "min-w-0 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300 [animation-fill-mode:both]",
              // Solo con dos columnas: en una sola, un span de 2 crearía una columna fantasma.
              ampliada &&
                (pieza.tipo === "indicadores" || pieza.tipo === "conclusion" || pieza.tipo === "tabla") &&
                "xl:col-span-2",
            )}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            {pieza.tipo === "conclusion" ? (
              <PiezaConclusion storeId={storeId} pregunta={pregunta} vista={vista} />
            ) : (
              <PiezaConDatos pieza={pieza} storeId={storeId} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
