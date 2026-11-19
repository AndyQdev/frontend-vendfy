import { useEffect, useState } from "react";
import { Loader2, MessageSquare, MoreHorizontal, Pencil, Search, SquarePen, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useBorrarConversacion, useConversaciones, useRenombrarConversacion } from "@/entities/omnibox/api";
import type { ConversacionResumen } from "@/entities/omnibox/model/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/shared/ui/sheet";
import { cn } from "@/shared/lib/cn";

import { agrupar, cuandoFue, enCursoTexto } from "../../model/conversacion";

/**
 * Las conversaciones guardadas (G5), como la columna de ChatGPT: buscar,
 * abrir, renombrar y borrar. Es una hoja que sale de la izquierda (en la
 * compu y en el teléfono): no le quita ancho al chat ni a la mesa.
 *
 * Solo las de esta persona en esta tienda: las de los empleados no se ven.
 */
export function PanelConversaciones({
  abierto,
  onCerrar,
  storeId,
  actualId,
  onAbrir,
  onNueva,
  onBorrada,
  onRenombrada,
}: {
  abierto: boolean;
  onCerrar: () => void;
  storeId: string;
  actualId: string | null;
  onAbrir: (id: string) => void;
  onNueva: () => void;
  /** Se borró una conversación (si era la abierta, la pantalla empieza una nueva). */
  onBorrada: (id: string) => void;
  /** Si se renombró la abierta, la barra de arriba muestra el nombre nuevo. */
  onRenombrada?: (id: string, titulo: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setQ(texto), 300);
    return () => window.clearTimeout(t);
  }, [texto]);
  const lista = useConversaciones(storeId, q, abierto);
  const [editando, setEditando] = useState<string | null>(null);
  const [aBorrar, setABorrar] = useState<ConversacionResumen | null>(null);
  const renombrar = useRenombrarConversacion();
  const borrar = useBorrarConversacion();

  async function guardarNombre(c: ConversacionResumen, nombre: string) {
    setEditando(null);
    const limpio = nombre.trim();
    if (!limpio || limpio === c.titulo) return;
    try {
      const r = await renombrar.mutateAsync({ storeId, id: c.id, titulo: limpio });
      onRenombrada?.(c.id, r.titulo);
    } catch (error: any) {
      toast.error(error?.message ?? "No pude renombrarla.");
    }
  }

  async function confirmarBorrado() {
    const c = aBorrar;
    setABorrar(null);
    if (!c) return;
    try {
      await borrar.mutateAsync({ storeId, id: c.id });
      onBorrada(c.id);
    } catch (error: any) {
      toast.error(error?.message ?? "No pude borrarla.");
    }
  }

  const grupos = agrupar(lista.data ?? []);

  return (
    <>
      <Sheet open={abierto} onOpenChange={(v) => !v && onCerrar()}>
        <SheetContent side="left" className="flex w-[88vw] max-w-sm flex-col gap-0 p-0" data-testid="panel-conversaciones">
          <div className="border-b border-border px-4 pb-3 pt-4">
            <SheetTitle className="text-base">Conversaciones</SheetTitle>
            <SheetDescription className="sr-only">Abre una conversación anterior o empieza una nueva.</SheetDescription>
            <button
              type="button"
              data-testid="conversacion-nueva"
              onClick={onNueva}
              className="mt-3 flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-muted"
            >
              <SquarePen className="size-4 text-muted-foreground" />
              Nueva conversación
            </button>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Buscar en lo que dijiste…"
                aria-label="Buscar conversaciones"
                data-testid="conversacion-buscar"
                className="h-10 pl-9 text-base sm:text-sm"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2" aria-busy={lista.isFetching}>
            {lista.isLoading ? (
              <p className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Cargando…
              </p>
            ) : grupos.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground" data-testid="conversaciones-vacias">
                {q.trim() ? `Nada que coincida con "${q.trim()}".` : "Todavía no hay conversaciones guardadas."}
              </p>
            ) : (
              grupos.map((g) => (
                <section key={g.titulo} className="mb-2">
                  <h3 className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">{g.titulo}</h3>
                  <ul>
                    {g.items.map((c) => {
                      const actual = c.id === actualId;
                      const enCurso = enCursoTexto(c.enCurso);
                      return (
                        <li
                          key={c.id}
                          data-testid="conversacion-item"
                          data-id={c.id}
                          data-actual={actual}
                          className={cn("group flex items-center gap-1 rounded-lg pr-1", actual ? "bg-primary-soft" : "hover:bg-muted")}
                        >
                          {editando === c.id ? (
                            <Input
                              autoFocus
                              defaultValue={c.titulo}
                              aria-label="Nuevo nombre"
                              data-testid="conversacion-nombre"
                              maxLength={120}
                              className="m-1 h-9 text-base sm:text-sm"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void guardarNombre(c, e.currentTarget.value);
                                if (e.key === "Escape") setEditando(null);
                              }}
                              onBlur={(e) => void guardarNombre(c, e.currentTarget.value)}
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => onAbrir(c.id)}
                              aria-current={actual ? "true" : undefined}
                              className="flex min-w-0 flex-1 items-start gap-2.5 rounded-lg px-3 py-2 text-left"
                            >
                              <MessageSquare className={cn("mt-0.5 size-4 shrink-0", actual ? "text-primary" : "text-muted-foreground")} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-foreground">{c.titulo}</span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {cuandoFue(c.actualizada)}
                                  {enCurso ? <span className="font-medium text-primary"> · {enCurso}</span> : null}
                                </span>
                              </span>
                            </button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label={`Opciones de ${c.titulo}`}
                                data-testid="conversacion-opciones"
                                className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground opacity-100 transition-opacity hover:bg-border hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 sm:data-[state=open]:opacity-100"
                              >
                                <MoreHorizontal className="size-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem data-testid="conversacion-renombrar" onSelect={() => setEditando(c.id)} className="gap-2 text-[13px]">
                                <Pencil className="size-4" />
                                Renombrar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                data-testid="conversacion-borrar"
                                onSelect={() => setABorrar(c)}
                                className="gap-2 text-[13px] text-destructive focus:text-destructive"
                              >
                                <Trash2 className="size-4" />
                                Borrar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={aBorrar !== null} onOpenChange={(v) => !v && setABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar «{aBorrar?.titulo}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra la conversación{aBorrar && enCursoTexto(aBorrar.enCurso) ? " y lo que quedó a medio armar en ella" : ""}. No se
              puede deshacer. Las ventas y compras que ya se registraron no se tocan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction data-testid="conversacion-borrar-confirmar" onClick={() => void confirmarBorrado()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
