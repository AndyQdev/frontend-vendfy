import type { Dispatch } from "react";
import { BarChart3, CalendarRange, ChevronDown, LayoutDashboard } from "lucide-react";

import type { Periodo, PiezaVista } from "@/entities/omnibox/model/types";
import { useVistasFijadas } from "@/entities/omnibox/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { cn } from "@/shared/lib/cn";

import type { AccionMesa, Analisis } from "../../model/mesa";
import { PERIODOS, periodoComun } from "../../model/vistas";
import { AccionesVistaContext, type AccionesVista } from "./acciones";
import { PiezaAlerta, PiezaComparativa, PiezaConclusion, PiezaConDatos } from "./Piezas";

/** Las piezas que en dos columnas van igual a todo el ancho: se leen de corrido. */
const ANCHAS: PiezaVista["tipo"][] = ["indicadores", "alerta", "comparativa", "tabla", "accion", "conclusion"];

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
  acciones = null,
}: {
  analisis: Analisis;
  storeId: string;
  despachar: Dispatch<AccionMesa>;
  ampliada: boolean;
  /** Abrir un producto, cargar a la compra (G4). Sin acciones, la vista solo se mira. */
  acciones?: AccionesVista | null;
}) {
  const { vista, pregunta } = analisis;
  const periodo = periodoComun(vista);
  const fijadas = useVistasFijadas(storeId).data ?? [];

  return (
    <AccionesVistaContext.Provider value={acciones}>
      <div data-testid="omnibox-vista" className="space-y-3 p-3 sm:p-4">
        {periodo || fijadas.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2" data-no-imprimir>
            {periodo ? (
              <>
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
              </>
            ) : null}
            {fijadas.length > 0 && acciones ? (
              // El tablero a mano también en medio de una conversación.
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    data-testid="vista-tablero"
                    className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-[13px] font-medium text-foreground transition-colors hover:border-border-strong hover:bg-muted"
                  >
                    <LayoutDashboard className="size-4 text-muted-foreground" />
                    Tu tablero
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-w-[18rem]">
                  {fijadas.map((f) => (
                    <DropdownMenuItem key={f.id} onSelect={() => acciones.abrirFijada(f)} className="gap-2 text-[13px]">
                      <BarChart3 className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{f.nombre}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        ) : null}

        <div className={cn("grid gap-3", ampliada && "xl:grid-cols-2")}>
          {vista.piezas.map((pieza, i) => (
            <div
              key={pieza.id}
              className={cn(
                "min-w-0 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300 [animation-fill-mode:both]",
                // Solo con dos columnas: en una sola, un span de 2 crearía una columna fantasma.
                ampliada && ANCHAS.includes(pieza.tipo) && "xl:col-span-2",
              )}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              {pieza.tipo === "conclusion" ? (
                <PiezaConclusion storeId={storeId} pregunta={pregunta} vista={vista} />
              ) : pieza.tipo === "alerta" ? (
                <PiezaAlerta pieza={pieza} storeId={storeId} />
              ) : pieza.tipo === "comparativa" ? (
                <PiezaComparativa pieza={pieza} storeId={storeId} />
              ) : (
                <PiezaConDatos pieza={pieza} storeId={storeId} />
              )}
            </div>
          ))}
        </div>
      </div>
    </AccionesVistaContext.Provider>
  );
}
