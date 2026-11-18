import { useState } from "react";
import { Gavel } from "lucide-react";
import { toast } from "sonner";

import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogBody as DialogBody,
} from "@/shared/ui/responsive-dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { usePrepararSubasta } from "@/entities/live/api";
import type { LiveItem } from "@/entities/live/model/types";

/** Duraciones que se ofrecen; null = sin tiempo, la cierra el vendedor. */
const DURACIONES: { segundos: number | null; nombre: string }[] = [
  { segundos: null, nombre: "La cierro yo" },
  { segundos: 60, nombre: "1 min" },
  { segundos: 120, nombre: "2 min" },
  { segundos: 180, nombre: "3 min" },
  { segundos: 300, nombre: "5 min" },
  { segundos: 600, nombre: "10 min" },
];

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
 *
 * La duración es opcional: si se elige, el tiempo corre desde que se abre y al
 * llegar a cero la puja se cierra sola y la prenda va al mejor postor. Sin
 * duración, la cierra el vendedor como siempre.
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
  const [duracion, setDuracion] = useState<number | null>(null);

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
        ...(duracion && { durationSeconds: duracion }),
      });
      toast.success(`"${item.name}" queda lista para subastar`);
      setStartingPrice("");
      setDuracion(null);
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

        <form onSubmit={enviar} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4">
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

          <div className="space-y-2">
            <Label>Duración de la puja</Label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Duración de la puja">
              {DURACIONES.map((d) => (
                <Button
                  key={d.nombre}
                  type="button"
                  size="sm"
                  role="radio"
                  aria-checked={duracion === d.segundos}
                  variant={duracion === d.segundos ? "default" : "outline"}
                  onClick={() => setDuracion(d.segundos)}
                >
                  {d.nombre}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {duracion
                ? "El tiempo corre desde que la abrís. Al llegar a cero se cierra sola y la prenda va al mejor postor."
                : "Sin tiempo: la cerrás vos desde el control del Live."}
            </p>
          </div>

          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={preparar.isPending}>
              {preparar.isPending ? "Guardando..." : "Preparar subasta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
