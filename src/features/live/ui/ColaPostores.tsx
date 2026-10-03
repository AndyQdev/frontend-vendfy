import { useState } from "react";
import { MessageCircle, SkipForward, Trophy, UserX } from "lucide-react";
import { toast } from "sonner";

import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogBody as DialogBody,
} from "@/shared/ui/responsive-dialog";
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
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import {
  useColaDePostores,
  usePasarAlSiguiente,
  usePremiarPuja,
} from "@/entities/live/api";
import type { PostorEnCola } from "@/entities/live/model/types";

/**
 * La cola de postores de una subasta cerrada.
 *
 * Es la pantalla que resuelve el caso real: se cerró la puja, el ganador no
 * contesta el WhatsApp, y hay que pasarle la prenda al siguiente. Por eso acá
 * sí se muestran los teléfonos -es información del vendedor, no del público- y
 * por eso se puede abrir desde el historial, no solo durante la transmisión:
 * lo normal es que contesten al día siguiente.
 *
 * "Pasar al siguiente" hace dos cosas de una: le devuelve la prenda al stock
 * quitándola de la cuenta del que no respondió, y se la carga al que sigue
 * AL MONTO QUE ESE OFRECIÓ, que es menor. Por eso la confirmación dice a quién
 * y por cuánto: es plata distinta.
 */
export function ColaPostores({
  open,
  onOpenChange,
  liveId,
  auctionId,
  nombrePrenda,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liveId: string;
  auctionId: string | null;
  nombrePrenda?: string;
}) {
  const { data: cola = [], isLoading } = useColaDePostores(
    liveId,
    auctionId ?? undefined,
    { refrescarCada: open ? 10_000 : undefined },
  );
  const pasar = usePasarAlSiguiente(liveId);
  const premiar = usePremiarPuja(liveId);
  const [confirmando, setConfirmando] = useState(false);

  const premiado = cola.find((p) => p.status === "awarded");
  const siguiente = cola.find((p) => p.status === "queued");

  const confirmarPase = async () => {
    if (!auctionId) return;
    try {
      await pasar.mutateAsync(auctionId);
      toast.success(
        siguiente
          ? `La prenda pasó a ${siguiente.name} por ${siguiente.amount.toFixed(2)}`
          : "La prenda volvió a estar disponible",
      );
    } catch (error) {
      toast.error((error as Error).message || "No se pudo pasar al siguiente");
    } finally {
      setConfirmando(false);
    }
  };

  const premiarA = async (postor: PostorEnCola) => {
    if (!auctionId) return;
    try {
      await premiar.mutateAsync({ auctionId, bidId: postor.bidId });
      toast.success(`La prenda es de ${postor.name} por ${postor.amount.toFixed(2)}`);
    } catch (error) {
      toast.error((error as Error).message || "No se pudo asignar");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Postores{nombrePrenda ? ` — ${nombrePrenda}` : ""}</DialogTitle>
            <DialogDescription>
              Si el que tiene la prenda no responde, pasala al siguiente.
            </DialogDescription>
          </DialogHeader>

        <DialogBody>
          {isLoading && (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
          )}

          {!isLoading && cola.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <UserX className="h-8 w-8" />
              <p className="text-sm">Nadie pujó por esta prenda.</p>
            </div>
          )}

          <div className="max-h-80 space-y-1 overflow-y-auto">
            {cola.map((p) => (
              <div
                key={p.bidId}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                  p.status === "awarded" ? "bg-success/10" : ""
                } ${p.status === "declined" ? "opacity-50" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    {p.status === "awarded" && (
                      <Badge variant="outline" className="gap-1">
                        <Trophy className="h-3 w-3" />
                        La tiene
                      </Badge>
                    )}
                    {p.status === "declined" && (
                      <Badge variant="outline">No respondió</Badge>
                    )}
                  </div>
                  <a
                    href={`https://wa.me/${p.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                  >
                    <MessageCircle className="h-3 w-3" />
                    {p.phone}
                  </a>
                </div>

                <span className="tabular-nums text-sm font-semibold">
                  {p.amount.toFixed(2)}
                </span>

                {p.status === "queued" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => premiarA(p)}
                    disabled={premiar.isPending}
                  >
                    Dársela
                  </Button>
                )}
              </div>
            ))}
          </div>

          {premiado && (
            <div className="border-t pt-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setConfirmando(true)}
                disabled={pasar.isPending}
              >
                <SkipForward className="h-4 w-4" />
                <span className="ml-1">
                  {premiado.name} no responde: pasar al siguiente
                </span>
              </Button>
            </div>
          )}

        </DialogBody>

        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Pasar la prenda al siguiente?</AlertDialogTitle>
            <AlertDialogDescription>
              {siguiente ? (
                <>
                  Se le saca a <strong>{premiado?.name}</strong> y pasa a{" "}
                  <strong>{siguiente.name}</strong> por{" "}
                  <strong>{siguiente.amount.toFixed(2)}</strong>, que es lo que ofreció.
                  El monto baja de {premiado?.amount.toFixed(2)}.
                </>
              ) : (
                <>
                  No hay más postores. La prenda se le saca a{" "}
                  <strong>{premiado?.name}</strong> y vuelve a quedar disponible a su
                  precio de lista.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarPase}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
