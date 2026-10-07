import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Radio } from "lucide-react";
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
import { Textarea } from "@/shared/ui/textarea";
import { useCreateLive } from "@/entities/live/api";

/**
 * Crear un Live pide lo mínimo: un título.
 *
 * El formulario largo va en contra del caso de uso. Cuando alguien abre esto
 * ya tiene el teléfono en la mano y las prendas sobre la mesa; todo lo que se
 * pida acá es tiempo con la cámara apagada.
 */
export function CrearLiveModal({
  open,
  onOpenChange,
  storeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId?: string;
}) {
  const navigate = useNavigate();
  const crear = useCreateLive();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!storeId || storeId === "all") {
      toast.error("Elegí una tienda antes de crear el Live");
      return;
    }
    if (!title.trim()) {
      toast.error("Ponele un título al Live");
      return;
    }

    try {
      const live = await crear.mutateAsync({
        storeId,
        title: title.trim(),
        description: description.trim() || undefined,
      });
      toast.success("Live creado");
      onOpenChange(false);
      setTitle("");
      setDescription("");
      navigate(`/live/${live.id}`);
    } catch (error) {
      toast.error((error as Error).message || "No se pudo crear el Live");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-destructive" />
            Nuevo Live
          </DialogTitle>
          <DialogDescription>
            Después le agregás las prendas y compartís el enlace.
          </DialogDescription>
        </DialogHeader>

        {/* El formulario es el hijo flexible: el cuerpo scrollea y el pie
            queda fijo abajo, alcanzable con el pulgar. */}
        <form onSubmit={enviar} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="live-title">Título</Label>
            <Input
              id="live-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ropa usada - Domingo"
              autoFocus
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="live-desc">Descripción (opcional)</Label>
            <Textarea
              id="live-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Vintage, talles S y M"
              rows={2}
            />
          </div>

          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={crear.isPending}>
              {crear.isPending ? "Creando..." : "Crear Live"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
