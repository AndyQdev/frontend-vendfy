import { Gavel, Pencil, Radio, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import {
  useAbrirSubasta,
  useCerrarSubasta,
  useRemoveLiveItem,
} from "@/entities/live/api";
import type { LiveItem, LiveSessionDetail } from "@/entities/live/model/types";

/**
 * Las prendas del Live.
 *
 * `disponible` no está guardado en ningún lado: lo calcula el backend contra
 * el inventario en cada lectura. Por eso una prenda que se cobró en la caja
 * mientras el Live corre aparece agotada acá sola, sin que nadie la marque.
 */
export function GrillaItemsLive({
  live,
  enVivo,
  onSubastar,
  onVerCola,
  onEditar,
}: {
  live: LiveSessionDetail;
  /** En transmisión aparece el botón de subasta. */
  enVivo?: boolean;
  onSubastar?: (item: LiveItem) => void;
  onVerCola?: (item: LiveItem) => void;
  onEditar?: (item: LiveItem) => void;
}) {
  const quitar = useRemoveLiveItem(live.id);
  const abrir = useAbrirSubasta(live.id);
  const cerrar = useCerrarSubasta(live.id);

  const activos = live.items.filter((i) => i.status === "active");

  if (activos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        Todavía no hay prendas. Agregá la primera con la cámara.
      </p>
    );
  }

  const eliminar = async (item: LiveItem) => {
    try {
      await quitar.mutateAsync(item.id);
      toast.success(`"${item.name}" salió del Live`);
    } catch (error) {
      toast.error((error as Error).message || "No se pudo quitar");
    }
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

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {activos.map((item) => {
        const agotado = item.disponible <= 0;
        const subasta = item.auction;

        return (
          <div
            key={item.id}
            className="overflow-hidden rounded-lg border bg-card"
          >
            <button
              type="button"
              onClick={() => onEditar?.(item)}
              className="relative block aspect-square w-full bg-muted"
              title="Editar prenda"
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
              <span className="absolute bottom-2 right-2 rounded-full bg-tinta/70 p-1.5 text-white">
                <Pencil className="h-3.5 w-3.5" />
              </span>
            </button>

            <div className="space-y-2 p-2">
              <p className="truncate text-sm font-medium">{item.name}</p>
              <div className="flex items-center justify-between">
                <span className="tabular-nums text-sm">{item.price.toFixed(2)}</span>
                <span className="text-xs text-muted-foreground">
                  {item.disponible} disp.
                </span>
              </div>

              <div className="flex gap-1">
                {enVivo && (
                  <>
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
                  </>
                )}
                {!enVivo && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 px-2"
                      onClick={() => onSubastar?.(item)}
                      title="Subastar"
                      disabled={!!subasta}
                    >
                      <Gavel className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 px-2 text-destructive"
                      onClick={() => eliminar(item)}
                      title="Quitar del Live"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
