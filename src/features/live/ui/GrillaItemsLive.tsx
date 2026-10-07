import { useEffect, useState } from "react";
import { CheckSquare, Gavel, Pencil, Radio, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
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
import {
  useAbrirSubasta,
  useCerrarSubasta,
  useQuitarVariasPrendas,
  useRemoveLiveItem,
} from "@/entities/live/api";
import type { LiveItem, LiveSessionDetail } from "@/entities/live/model/types";

/**
 * Qué se puede hacer con una prenda depende del momento del Live.
 *
 * Preparando se arma el catálogo; en el aire se conduce; cerrado solo queda
 * mirar y llamar a la cola de postores. Lo que NO depende del momento es
 * quitar una prenda: equivocarse al cargarla en pleno unboxing es lo normal, y
 * obligar a terminar el Live para corregirlo sería peor que el error.
 *
 * `disponible` y `pedidos` no están guardados en ningún lado: los calcula el
 * backend en cada lectura. Por eso una prenda que se cobró en la caja mientras
 * el Live corre aparece agotada acá sola, sin que nadie la marque.
 */
export type EstadoGrilla = "preparando" | "vivo" | "cerrado";

export function GrillaItemsLive({
  live,
  estado,
  onSubastar,
  onVerCola,
  onEditar,
}: {
  live: LiveSessionDetail;
  estado: EstadoGrilla;
  onSubastar?: (item: LiveItem) => void;
  onVerCola?: (item: LiveItem) => void;
  onEditar?: (item: LiveItem) => void;
}) {
  const quitar = useRemoveLiveItem(live.id);
  const quitarVarias = useQuitarVariasPrendas(live.id);
  const abrir = useAbrirSubasta(live.id);
  const cerrar = useCerrarSubasta(live.id);

  const [seleccionando, setSeleccionando] = useState(false);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  /** Las que están esperando confirmación porque alguien ya las pidió. */
  const [porConfirmar, setPorConfirmar] = useState<LiveItem[] | null>(null);

  const editable = estado !== "cerrado";
  /**
   * Quitar de a varias es solo de preparación.
   *
   * En el aire el vendedor está conduciendo, con el teléfono en una mano: una
   * selección múltiple es una operación lenta y de consecuencias grandes, y no
   * es lo que se viene a hacer a esa pantalla. Corregir en vivo sigue estando,
   * pero de a una, que es como pasa en un unboxing.
   *
   * Es una decisión de pantalla, no una regla de integridad: el servidor
   * acepta quitar varias igual, porque hacerlo de a una ya está permitido y
   * prohibirlo ahí sería arbitrario. Lo que el servidor sí defiende -la puja
   * abierta- no depende de esto.
   */
  const puedeSeleccionar = estado === "preparando";
  const activos = live.items.filter((i) => i.status === "active");

  // Si el Live arranca con la selección abierta, la barra desaparece: sin
  // esto las tarjetas quedarían con las casillas puestas y sin salida.
  useEffect(() => {
    if (!puedeSeleccionar) {
      setSeleccionando(false);
      setElegidas(new Set());
    }
  }, [puedeSeleccionar]);

  if (activos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        Todavía no hay prendas. Agregá la primera con la cámara.
      </p>
    );
  }

  const salirDeSeleccion = () => {
    setSeleccionando(false);
    setElegidas(new Set());
  };

  const alternar = (id: string) => {
    setElegidas((previo) => {
      const siguiente = new Set(previo);
      siguiente.has(id) ? siguiente.delete(id) : siguiente.add(id);
      return siguiente;
    });
  };

  /** Hace el trabajo. Quien llama ya decidió si hacía falta confirmar. */
  const quitarAhora = async (items: LiveItem[]) => {
    try {
      if (items.length === 1) {
        await quitar.mutateAsync(items[0].id);
        toast.success(`"${items[0].name}" salió del Live`);
      } else {
        const r = await quitarVarias.mutateAsync(items.map((i) => i.id));
        toast.success(
          r.quitadas === 1
            ? "1 prenda salió del Live"
            : `${r.quitadas} prendas salieron del Live`,
        );
        // Una con la puja abierta no frena a las otras noventa, pero hay que
        // decir cuáles quedaron y por qué.
        if (r.rechazadas.length > 0) {
          toast.warning(
            r.rechazadas.length === 1
              ? "1 prenda no se pudo quitar"
              : `${r.rechazadas.length} prendas no se pudieron quitar`,
            { description: r.rechazadas[0].motivo },
          );
        }
      }
      salirDeSeleccion();
    } catch (error) {
      toast.error((error as Error).message || "No se pudo quitar");
    } finally {
      setPorConfirmar(null);
    }
  };

  /**
   * Sin pedidos sale directo: en un unboxing, corregir tiene que costar un
   * toque. Con pedidos se avisa, porque la prenda sigue en la cuenta de esa
   * persona y alguien se la va a reclamar.
   */
  const pedirQuitar = (items: LiveItem[]) => {
    if (items.some((i) => i.pedidos > 0)) setPorConfirmar(items);
    else void quitarAhora(items);
  };

  const accionSubasta = async (item: LiveItem) => {
    const subasta = item.auction;
    try {
      if (!subasta) return onSubastar?.(item);
      if (subasta.status === "pending") {
        await abrir.mutateAsync(subasta.id);
        toast.success("Subasta abierta: ya pueden pujar");
      } else if (subasta.status === "open") {
        await cerrar.mutateAsync(subasta.id);
        toast.success("Subasta cerrada");
      } else {
        onVerCola?.(item);
      }
    } catch (error) {
      toast.error((error as Error).message || "No se pudo");
    }
  };

  const elegidasItems = activos.filter((i) => elegidas.has(i.id));
  const pedidosEnConfirmacion = (porConfirmar ?? []).reduce(
    (s, i) => s + i.pedidos,
    0,
  );

  return (
    <div className="space-y-3">
      {puedeSeleccionar && (
        <div className="flex items-center justify-between gap-2">
          {seleccionando ? (
            <>
              <span className="text-sm text-muted-foreground">
                {elegidas.size} seleccionada{elegidas.size === 1 ? "" : "s"}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={salirDeSeleccion}>
                  <X className="h-4 w-4" />
                  <span className="ml-1">Cancelar</span>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={elegidas.size === 0 || quitarVarias.isPending}
                  onClick={() => pedirQuitar(elegidasItems)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="ml-1">Quitar {elegidas.size || ""}</span>
                </Button>
              </div>
            </>
          ) : (
            <>
              <span className="text-sm text-muted-foreground">
                {activos.length} prenda{activos.length === 1 ? "" : "s"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSeleccionando(true)}
              >
                <CheckSquare className="h-4 w-4" />
                <span className="ml-1">Seleccionar</span>
              </Button>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {activos.map((item) => {
          const agotado = item.disponible <= 0;
          const subasta = item.auction;
          const elegida = elegidas.has(item.id);

          return (
            <div
              key={item.id}
              className={`overflow-hidden rounded-lg border bg-card ${
                elegida ? "border-primary ring-1 ring-primary" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  if (!editable) return;
                  if (seleccionando) alternar(item.id);
                  else onEditar?.(item);
                }}
                disabled={!editable}
                className="relative block aspect-square w-full bg-muted"
                title={
                  !editable
                    ? item.name
                    : seleccionando
                      ? "Seleccionar"
                      : "Editar prenda"
                }
              >
                {item.imageUrls[0] ? (
                  <img
                    src={item.imageUrls[0]}
                    alt=""
                    className={`h-full w-full object-cover ${agotado ? "opacity-40" : ""}`}
                  />
                ) : (
                  <div className="grid h-full place-items-center text-muted-foreground">
                    <Radio className="h-8 w-8" />
                  </div>
                )}

                {agotado && (
                  <div className="absolute inset-0 grid place-items-center">
                    <Badge variant="destructive">Vendido</Badge>
                  </div>
                )}

                {subasta?.status === "open" && (
                  <Badge variant="warning" className="absolute right-2 top-2 gap-1">
                    <Gavel className="h-3 w-3" />
                    {subasta.currentAmount ?? subasta.startingPrice}
                  </Badge>
                )}

                {/* Siempre visible: un control detras de un hover no existe en
                    un telefono, que es desde donde se transmite. */}
                {editable && !seleccionando && (
                  <span className="absolute bottom-2 right-2 rounded-full bg-tinta/70 p-1.5 text-white">
                    <Pencil className="h-3.5 w-3.5" />
                  </span>
                )}

                {seleccionando && (
                  <span className="absolute left-2 top-2 rounded bg-card p-1 shadow-sm">
                    <Checkbox checked={elegida} aria-label={item.name} />
                  </span>
                )}
              </button>

              <div className="space-y-2 p-2">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <div className="flex items-center justify-between">
                  <span className="tabular-nums text-sm">{item.price.toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.disponible} disp.
                  </span>
                </div>

                {/* Que alguien ya la haya pedido cambia lo que significa
                    quitarla, así que se ve antes de tocar nada. */}
                {item.pedidos > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {item.pedidos} pedido{item.pedidos === 1 ? "" : "s"}
                  </p>
                )}

                {!seleccionando && (
                  <div className="flex gap-1">
                    {estado === "vivo" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 px-2"
                        onClick={() => accionSubasta(item)}
                        title={
                          !subasta
                            ? "Preparar subasta"
                            : subasta.status === "pending"
                              ? "Abrir puja"
                              : subasta.status === "open"
                                ? "Cerrar puja"
                                : "Ver postores"
                        }
                      >
                        {subasta?.status === "closed" ? (
                          <Users className="h-3.5 w-3.5" />
                        ) : (
                          <Gavel className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}

                    {estado === "preparando" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 px-2"
                        onClick={() => onSubastar?.(item)}
                        title={subasta ? "Ya tiene subasta" : "Subastar"}
                        disabled={!!subasta}
                      >
                        <Gavel className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {/* También en vivo: es el caso del unboxing. */}
                    {editable && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 px-2 text-destructive"
                        onClick={() => pedirQuitar([item])}
                        title="Quitar del Live"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {/* Cerrado: lo único que queda por hacer es llamar al
                        siguiente de la cola, que es para lo que se abre un
                        Live viejo al día siguiente. */}
                    {estado === "cerrado" && subasta && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 px-2"
                        onClick={() => onVerCola?.(item)}
                        title="Ver postores"
                      >
                        <Users className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog
        open={!!porConfirmar}
        onOpenChange={(abierto) => !abierto && setPorConfirmar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {porConfirmar?.length === 1
                ? `¿Quitar "${porConfirmar[0].name}"?`
                : `¿Quitar ${porConfirmar?.length} prendas?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pedidosEnConfirmacion === 1
                ? "Una persona ya la pidió. "
                : `${pedidosEnConfirmacion} personas ya las pidieron. `}
              Si la quitás deja de ofrecerse en el Live, pero{" "}
              <strong>sigue en sus cuentas</strong>: vas a tener que entregarla o
              hablar con ellas. El producto no se borra del inventario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Dejarla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => porConfirmar && quitarAhora(porConfirmar)}
            >
              Quitar igual
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
