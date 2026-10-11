import type { Dispatch } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";

import { useFichaRecurso } from "@/entities/omnibox/api";
import type { FichaRecurso } from "@/entities/omnibox/model/types";
import { cn } from "@/shared/lib/cn";
import { Skeleton } from "@/shared/ui/skeleton";

import type { AccionMesa, FichaAbierta } from "../../model/mesa";
import { celda } from "../../model/recursos";
import { BotonSecundario } from "../piezas";
import { EstadoChip } from "./EstadoChip";

/**
 * La ficha a la derecha (G9a): una venta con sus productos, una compra con
 * su proveedor, un cliente con lo que compró, un producto con sus
 * movimientos. Lo relacionado se abre ahí mismo (el cliente de la venta) y,
 * si vino de una lista, se vuelve a ella. Las acciones (anular, confirmar,
 * editar) se suman en G9c y siempre pasan por una tarjeta para confirmar.
 */
export function PanelFicha({
  ficha,
  inicial,
  storeId,
  despachar,
  onAccion,
}: {
  ficha: FichaAbierta;
  inicial?: FichaRecurso;
  storeId: string;
  despachar: Dispatch<AccionMesa>;
  /** Una acción de la ficha: arma la tarjeta en el chat para confirmarla. */
  onAccion?: (accion: FichaRecurso["acciones"][number], ficha: FichaRecurso) => void;
}) {
  const consulta = useFichaRecurso(storeId, ficha.recurso, ficha.id, inicial);
  const f = consulta.data;

  return (
    <div data-testid="panel-ficha" data-recurso={ficha.recurso} className="flex min-h-full flex-col">
      {ficha.desdeLista ? (
        <button
          type="button"
          onClick={() => despachar({ tipo: "volverALista" })}
          className="flex items-center gap-1.5 border-b border-border px-4 py-2 text-xs font-medium text-primary hover:bg-muted/50"
        >
          <ArrowLeft className="size-3.5" />
          Volver a la lista
        </button>
      ) : null}

      {!f ? (
        consulta.isError ? (
          <p className="px-6 py-16 text-center text-sm text-destructive">{String((consulta.error as Error)?.message ?? "No se pudo abrir")}</p>
        ) : (
          <div className="space-y-3 p-4" aria-busy>
            <Skeleton className="h-6 w-1/2" />
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        )
      ) : (
        <div className="space-y-4 p-4">
          <header className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h3 data-testid="ficha-titulo" className="font-sans text-base font-semibold leading-tight text-foreground">
                {f.titulo}
              </h3>
            </div>
            {f.subtitulo ? <EstadoChip texto={f.subtitulo} className="mt-0.5" /> : null}
          </header>

          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
            {f.datos.map((d) => (
              <div key={d.etiqueta} className="contents">
                <dt className="text-muted-foreground">{d.etiqueta}</dt>
                <dd className="min-w-0 break-words text-foreground">{d.valor}</dd>
              </div>
            ))}
          </dl>

          {f.enlaces.length ? (
            <div className="flex flex-wrap gap-2">
              {f.enlaces.map((e) => (
                <button
                  key={`${e.recurso}:${e.id}`}
                  type="button"
                  onClick={() => despachar({ tipo: "abrirFicha", ficha: { recurso: e.recurso, id: e.id, titulo: e.etiqueta, desdeLista: ficha.desdeLista } })}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:border-border-strong"
                >
                  Ver {e.recurso === "clientes" ? "el cliente" : e.etiqueta}: {e.etiqueta}
                  <ChevronRight className="size-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : null}

          {f.tabla ? (
            <section>
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{f.tabla.titulo}</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    {f.tabla.columnas.map((c) => (
                      <th key={c.clave} scope="col" className={cn("py-1.5 pr-3 font-medium", (c.formato === "dinero" || c.formato === "numero") && "text-right")}>
                        {c.etiqueta}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {f.tabla.filas.map((fila, i) => (
                    <tr key={i} className="border-b border-border/70 align-top">
                      {f.tabla!.columnas.map((c, j) => (
                        <td
                          key={c.clave}
                          className={cn(
                            "py-1.5 pr-3",
                            j === 0 && "text-foreground",
                            (c.formato === "dinero" || c.formato === "numero") && "cifra whitespace-nowrap text-right",
                            c.formato === "fecha" && "cifra whitespace-nowrap text-muted-foreground",
                          )}
                        >
                          {c.formato === "estado" && fila[c.clave] ? <EstadoChip texto={String(fila[c.clave])} /> : celda(fila[c.clave], c.formato)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {f.acciones.length && onAccion ? (
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              {f.acciones.map((a) => (
                <BotonSecundario
                  key={a.operacion}
                  type="button"
                  data-testid="ficha-accion"
                  onClick={() => onAccion(a, f)}
                  className={cn(a.seria && "border-destructive/40 text-destructive hover:bg-destructive-soft")}
                >
                  {a.etiqueta}
                </BotonSecundario>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
