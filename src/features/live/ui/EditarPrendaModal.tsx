import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
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
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { apiFetch } from "@/shared/api/client";
import { useEditarPrenda, useEliminarProducto } from "@/entities/live/api";
import type { LiveItem } from "@/entities/live/model/types";

/**
 * Corregir una prenda sin salir del Live.
 *
 * Equivocarse de foto o de precio mientras se transmite es lo normal, y hasta
 * ahora obligaba a irse al catálogo, buscar el producto y volver.
 *
 * La foto se cambia tocando la imagen: no hay botón escondido detrás de un
 * hover, que en un teléfono no existe.
 */
export function EditarPrendaModal({
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
  const inputFoto = useRef<HTMLInputElement>(null);
  const editar = useEditarPrenda(liveId);
  const eliminar = useEliminarProducto(liveId);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  // Al abrir, el formulario arranca con lo que la prenda tiene hoy.
  useEffect(() => {
    if (!open || !item) return;
    setName(item.name);
    setPrice(String(item.price));
    setPreview(item.imageUrls[0] ?? null);
    setImageUrl(null);
  }, [open, item]);

  const elegirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await apiFetch<{ url: string }>("/api/product/upload-image", {
        method: "POST",
        body: formData,
      });
      if (!res.data?.url) throw new Error("La imagen no se pudo guardar");
      setImageUrl(res.data.url);
    } catch (error) {
      toast.error((error as Error).message || "No se pudo subir la foto");
      setPreview(item?.imageUrls[0] ?? null);
    } finally {
      setSubiendo(false);
      // Sin esto, volver a elegir el MISMO archivo no dispara el evento.
      if (inputFoto.current) inputFoto.current.value = "";
    }
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    if (!name.trim()) return toast.error("Falta el nombre");

    const precio = Number(price);
    if (!Number.isFinite(precio) || precio <= 0) return toast.error("Precio inválido");
    if (subiendo) return toast.error("Esperá a que termine de subir la foto");

    try {
      await editar.mutateAsync({
        itemId: item.id,
        // Solo viaja lo que cambió.
        ...(name.trim() !== item.name ? { name: name.trim() } : {}),
        ...(precio !== item.price ? { price: precio } : {}),
        ...(imageUrl ? { imageUrl } : {}),
      });
      toast.success("Prenda actualizada");
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message || "No se pudo guardar");
    }
  };

  const confirmarBorrado = async () => {
    if (!item) return;
    try {
      await eliminar.mutateAsync(item.id);
      toast.success(`"${item.name}" eliminado`);
      setConfirmando(false);
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message || "No se pudo eliminar");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar prenda</DialogTitle>
            <DialogDescription>Tocá la foto para cambiarla.</DialogDescription>
          </DialogHeader>

          <form onSubmit={guardar} className="flex min-h-0 flex-1 flex-col">
            <DialogBody className="space-y-4">
            <input
              ref={inputFoto}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={elegirFoto}
            />

            <button
              type="button"
              onClick={() => inputFoto.current?.click()}
              className="relative block h-48 w-full overflow-hidden rounded-lg border bg-muted"
            >
              {preview ? (
                <img src={preview} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Camera className="h-7 w-7" />
                  <span className="text-sm">Agregar foto</span>
                </span>
              )}

              {subiendo ? (
                <span className="absolute inset-0 grid place-items-center bg-tinta/40">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </span>
              ) : (
                preview && (
                  <span className="absolute bottom-2 right-2 rounded-full bg-tinta/70 px-3 py-1 text-xs text-white">
                    Cambiar
                  </span>
                )
              )}
            </button>

            <div className="space-y-2">
              <Label htmlFor="ed-name">Nombre</Label>
              <Input
                id="ed-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ed-price">Precio</Label>
              <Input
                id="ed-price"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>

            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                className="text-destructive md:mr-auto"
                onClick={() => setConfirmando(true)}
                disabled={eliminar.isPending}
              >
                <Trash2 className="h-4 w-4" />
                <span className="ml-1">Eliminar</span>
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={editar.isPending || subiendo}>
                {editar.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{item?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Sale del Live y se da de baja del inventario. Es distinto de "quitar del
              Live", que la deja disponible para la próxima transmisión. Lo que ya se
              haya vendido no se toca.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarBorrado}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
