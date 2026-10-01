import { useState } from "react";
import { Gavel } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { usePrepararSubasta } from "@/entities/live/api";
import type { LiveItem } from "@/entities/live/model/types";

/**
 * Configurar la subasta de una prenda.
 *
 * El precio inicial es aparte del precio de venta directa: sirve para arrancar
 * la puja por debajo de lo que vale, que es lo que hace que la gente entre. Si
 * la subasta termina sin ofertas, la prenda vuelve a su precio de lista.
 *
 * Esto solo la deja preparada. Abrirla -que es cuando la gente puede pujar- es
 * un botón aparte en el panel de control, para que el vendedor la largue
 * cuando tenga la prenda en la mano.
 */
export function ConfigurarSubastaModal({
  open,
  onOpenChange,
  liveId,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liveId: string;
  item: LiveItem | null;
}) {
  const preparar = usePrepararSubasta(liveId);
  const [startingPrice, setStartingPrice] = useState("");
  const [minIncrement, setMinIncrement] = useState("10");

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    const inicial = Number(startingPrice);
    const incremento = Number(minIncrement);
    if (!Number.isFinite(inicial) || inicial < 0) {
      return toast.error("Precio inicial inválido");
    }
    if (!Number.isFinite(incremento) || incremento <= 0) {
      return toast.error("El incremento tiene que ser mayor a cero");
    }

    try {
      await preparar.mutateAsync({
        itemId: item.id,
        startingPrice: inicial,
        minIncrement: incremento,
      });
      toast.success(`"${item.name}" queda lista para subastar`);
      setStartingPrice("");
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message || "No se pudo preparar la subasta");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5" />
            Subastar {item?.name}
          </DialogTitle>
          <DialogDescription>
            Queda preparada. La abrís cuando la tengas en la mano.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={enviar} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sub-inicial">Precio inicial</Label>
            <Input
              id="sub-inicial"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={startingPrice}
              onChange={(e) => setStartingPrice(e.target.value)}
              placeholder={item ? String(Math.round(item.price / 2)) : "50"}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Su precio de venta directa es {item?.price.toFixed(2)}.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sub-incremento">Subida mínima por puja</Label>
            <Input
              id="sub-incremento"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={minIncrement}
              onChange={(e) => setMinIncrement(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={preparar.isPending}>
              {preparar.isPending ? "Guardando..." : "Preparar subasta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
