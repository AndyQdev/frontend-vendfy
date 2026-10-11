import { useEffect, useRef, useState, type Dispatch } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronRight, Download, X } from "lucide-react";
import { toast } from "sonner";

import { useListaRecurso } from "@/entities/omnibox/api";
import type { ListaRecurso } from "@/entities/omnibox/model/types";
import { cn } from "@/shared/lib/cn";
import { Skeleton } from "@/shared/ui/skeleton";

import { libroExcel } from "../../model/excel";
import { nombreArchivo } from "../../model/exportar";
import type { AccionMesa, ListaAbierta } from "../../model/mesa";
import { celda, hojaDeLista, ordenDeColumna, resumenLista, siguienteOrden, sinFiltro } from "../../model/recursos";
import { BotonIcono } from "../piezas";
import { EstadoChip } from "./EstadoChip";

/** Hasta cuántas filas trae "Ver más" (el servidor no da más de 100 por vez). */
const TOPE = 100;
/** Desde este ancho del panel, tabla; más angosto (teléfono, panel chico), una tarjeta por fila. */
const ANCHO_TABLA = 560;

/** El ancho del panel (no de la pantalla): el mismo panel va al costado o abajo. */
function useAncho<T extends HTMLElement>(montado: boolean) {
  const ref = useRef<T>(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setAncho(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [montado]);
  return [ref, ancho] as const;
}

/**
 * La lista a la derecha (G9a): las ventas, compras, productos o clientes que
 * se pidieron, con sus filtros como chips. Es la pantalla de siempre, pero
 * armada por la frase: sacar un chip, tocar una columna para ordenar o "Ver
 * más" vuelven a consultar sin pasar por el modelo; tocar una fila abre su
 * ficha. Lo que se pide hablando ("solo las de QR") la reemplaza.
 */
export function PanelLista({
  lista,
  inicial,
  storeId,
  despachar,
  tienda,
}: {
  lista: ListaAbierta;
  /** La que trajo el agente: se muestra sin esperar. */
  inicial?: ListaRecurso;
  storeId: string;
  despachar: Dispatch<AccionMesa>;
  tienda: string;
}) {
  const consulta = useListaRecurso(storeId, lista.consulta, inicial);
  const datos = consulta.data;
  // Mientras carga se muestra el esqueleto, sin la lista: se mide cuando aparece.
  const [ref, ancho] = useAncho<HTMLDivElement>(Boolean(datos));
  const tabla = ancho >= ANCHO_TABLA;
  const c = lista.consulta;

  if (!datos) {
    return consulta.isError ? (
      <p className="px-6 py-16 text-center text-sm text-destructive">No se pudo traer la lista. {String((consulta.error as Error)?.message ?? "")}</p>
    ) : (
      <div className="space-y-2 p-4" aria-busy>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  const ordenar = (campo: string) => despachar({ tipo: "consultaLista", consulta: { ...c, orden: siguienteOrden(c.orden, campo), desde: 0 } });
  const sacar = (clave: string) => despachar({ tipo: "consultaLista", consulta: { ...c, filtros: sinFiltro(c.filtros, clave), desde: 0 } });
  const abrir = (fila: Record<string, unknown>) => {
    if (!datos.conFicha || typeof fila._id !== "string") return;
    const titulo = String(fila.cliente ?? fila.producto ?? fila.proveedor ?? (fila.numero ? `#${fila.numero}` : datos.singular));
    despachar({ tipo: "abrirFicha", ficha: { recurso: datos.recurso, id: fila._id, titulo, desdeLista: true } });
  };
  const exportar = () => {
    try {
      const bytes = libroExcel([hojaDeLista(datos)]);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = nombreArchivo(`${datos.titulo} ${tienda}`, new Date(), "xlsx");
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("No se pudo armar el Excel");
    }
  };
  const faltan = datos.resumen.total - datos.filas.length;

  return (
    <div
      ref={ref}
      data-testid="panel-lista"
      data-recurso={datos.recurso}
      className={cn("flex min-h-full flex-col", consulta.isFetching && "opacity-70 transition-opacity")}
    >
      {/* ---- lo que se está viendo: cuántos, cuánta plata, con qué filtros */}
      <div className="space-y-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <p data-testid="lista-resumen" className="cifra min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
            {resumenLista(datos)}
          </p>
          <BotonIcono etiqueta="Bajar a Excel" onClick={exportar} disabled={!datos.filas.length}>
            <Download />
          </BotonIcono>
        </div>
        {datos.chips.length ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Filtros">
            {datos.chips.map((chip) => (
              <li key={chip.clave}>
                <button
                  type="button"
                  data-testid="lista-chip"
                  onClick={() => sacar(chip.clave)}
                  aria-label={`Sacar el filtro ${chip.texto}`}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 py-0.5 pl-2.5 pr-1.5 text-xs text-foreground hover:border-border-strong"
                >
                  {chip.texto}
                  <X className="size-3 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Sin filtros. Pedime los que quieras: «solo las de septiembre», «las de QR»…</p>
        )}
        {datos.ignorados?.length ? (
          <p className="flex items-start gap-1.5 text-xs text-warning-soft-foreground">
            <AlertTriangle className="mt-px size-3.5 shrink-0 text-warning" />
            No apliqué: {datos.ignorados.join("; ")}.
          </p>
        ) : null}
      </div>

      {datos.filas.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-muted-foreground">No hay {datos.titulo.toLowerCase()} con esos filtros.</p>
      ) : (
        <>
          {/* ---- panel ancho: la tabla */}
          {tabla ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  {datos.columnas.map((col) => {
                    const campo = ordenDeColumna(col.clave, datos.ordenes);
                    const activa = campo && c.orden.campo === campo;
                    const derecha = col.formato === "dinero" || col.formato === "numero";
                    return (
                      <th key={col.clave} scope="col" className={cn("whitespace-nowrap px-3 py-2 font-medium first:pl-4", derecha && "text-right")}>
                        {campo ? (
                          <button type="button" onClick={() => ordenar(campo)} className={cn("inline-flex items-center gap-1 hover:text-foreground", activa && "text-foreground")}>
                            {col.etiqueta}
                            {activa ? c.orden.sentido === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}
                          </button>
                        ) : (
                          col.etiqueta
                        )}
                      </th>
                    );
                  })}
                  {datos.conFicha ? <th aria-hidden className="w-6" /> : null}
                </tr>
              </thead>
              <tbody>
                {datos.filas.map((fila, i) => (
                  <tr
                    key={String(fila._id ?? i)}
                    data-testid="lista-fila"
                    onClick={() => abrir(fila)}
                    className={cn("border-b border-border/70 align-top", datos.conFicha && "cursor-pointer hover:bg-muted/50")}
                  >
                    {datos.columnas.map((col, j) => (
                      <td
                        key={col.clave}
                        className={cn(
                          "px-3 py-2 first:pl-4",
                          j === 0 && "font-medium text-foreground",
                          (col.formato === "dinero" || col.formato === "numero") && "cifra whitespace-nowrap text-right",
                          col.formato === "fecha" && "cifra whitespace-nowrap text-muted-foreground",
                          col.clave === "productos" && "max-w-[12rem] truncate text-muted-foreground",
                        )}
                        title={col.clave === "productos" ? String(fila[col.clave] ?? "") : undefined}
                      >
                        {col.formato === "estado" && fila[col.clave] ? <EstadoChip texto={String(fila[col.clave])} /> : celda(fila[col.clave], col.formato)}
                      </td>
                    ))}
                    {datos.conFicha ? (
                      <td className="pr-3 pt-2.5 text-muted-foreground">
                        <ChevronRight className="size-4" />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          ) : (
          /* ---- angosto (teléfono o panel chico): una tarjeta por fila */
          <ul className="divide-y divide-border">
            {datos.filas.map((fila, i) => {
              const [primera, ...resto] = datos.columnas;
              return (
                <li key={String(fila._id ?? i)}>
                  <button
                    type="button"
                    data-testid="lista-fila"
                    disabled={!datos.conFicha}
                    onClick={() => abrir(fila)}
                    className="flex w-full items-start gap-2 px-4 py-2.5 text-left enabled:hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{celda(fila[primera.clave], primera.formato)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {resto
                          .filter((col) => fila[col.clave] !== null && fila[col.clave] !== undefined && fila[col.clave] !== "")
                          .map((col) => (col.formato === "estado" || col.clave === "productos" || col.clave === "cliente" ? celda(fila[col.clave], col.formato) : `${col.etiqueta} ${celda(fila[col.clave], col.formato)}`))
                          .join(" · ")}
                      </p>
                    </div>
                    {datos.conFicha ? <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          )}

          {faltan > 0 ? (
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs text-muted-foreground">
              <span className="cifra">
                Mostrando {datos.filas.length} de {datos.resumen.total}.
              </span>
              {c.limite < TOPE ? (
                <button
                  type="button"
                  onClick={() => despachar({ tipo: "consultaLista", consulta: { ...c, limite: Math.min(TOPE, c.limite + 50) } })}
                  className="font-medium text-primary hover:underline"
                >
                  Ver más
                </button>
              ) : (
                <span>Para ver otras, pedímelas con un filtro.</span>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
