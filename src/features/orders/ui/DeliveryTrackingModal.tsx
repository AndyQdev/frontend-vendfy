import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, Truck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useUpdateOrder } from "@/entities/order/api";
import type { Order } from "@/entities/order/model/types";

/**
 * Al pasar un pedido a "En camino" le preguntamos a la tienda si quiere pegar
 * el link de seguimiento del repartidor (Yango, Pedidos Ya, una ubicación en
 * vivo de WhatsApp...). Si lo carga, al cliente se le habilita el botón
 * "Seguir a mi repartidor" en su página de seguimiento.
 *
 * Es opcional a propósito: el pedido ya cambió de estado, esto solo suma.
 */
export function DeliveryTrackingModal({
  order,
  open,
  onOpenChange,
}: {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [url, setUrl] = useState("");
  const updateOrder = useUpdateOrder();

  useEffect(() => {
    if (open) setUrl(order?.deliveryInfo?.trackingUrl ?? "");
  }, [open, order]);

  if (!order) return null;

  const trimmed = url.trim();
  const valid = !trimmed || /^https?:\/\/\S+$/i.test(trimmed);

  const save = async () => {
    if (!valid) return;
    await updateOrder.mutateAsync({
      id: order.id,
      data: {
        deliveryInfo: {
          ...(order.deliveryInfo ?? { address: "", cost: 0 }),
          trackingUrl: trimmed || undefined,
        },
      } as any,
    });
    toast.success(
      trimmed
        ? "Listo, tu cliente ya puede seguir al repartidor"
        : "Guardado sin link de seguimiento",
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            ¿Compartes el seguimiento?
          </DialogTitle>
          <DialogDescription>
            El pedido {order.number ? `#${order.number}` : ""} salió en camino.
            Si pegas aquí el link del repartidor, tu cliente puede seguirlo en
            vivo desde su celular.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="tracking-url">Link de seguimiento</Label>
          <Input
            id="tracking-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yango.go.link/..."
            autoFocus
          />
          {!valid && (
            <p className="text-sm text-destructive">
              Debe empezar con http:// o https://
            </p>
          )}
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
            Sirve cualquier link que abra el seguimiento: Yango, Pedidos Ya, o
            la ubicación en tiempo real que te comparte tu repartidor.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateOrder.isPending}
          >
            Ahora no
          </Button>
          <Button onClick={save} disabled={!valid || updateOrder.isPending}>
            {updateOrder.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
