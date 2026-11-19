import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
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
import { apiFetch } from "@/shared/api/client";
import { useQuickAddItem } from "@/entities/live/api";

/**
 * El alta rápida: foto, nombre, precio.
 *
 * Es el flujo que le da sentido al módulo. La prenda entra al inventario
 * mientras la cámara sigue prendida, así que todo lo que no sea imprescindible
 * está afuera: ni categoría, ni marca, ni código.
 *
 * `capture="environment"` hace que en el teléfono se abra la cámara trasera
 * directo en vez del explorador de archivos, que es donde se pierde el tiempo.
 */
export function AltaRapidaProducto({
  open,
  onOpenChange,
  liveId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liveId: string;
}) {
  const inputFoto = useRef<HTMLInputElement>(null);
  const agregar = useQuickAddItem(liveId);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");

  const limpiar = () => {
    setImageUrl(null);
    setPreview(null);
    setName("");
    setPrice("");
    setStock("1");
  };

  const elegirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Se muestra la foto local al instante y la subida corre por detrás: el
    // vendedor puede ir escribiendo el nombre mientras el archivo viaja.
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
      setPreview(null);
    } finally {
      setSubiendo(false);
    }
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return toast.error("Falta el nombre");
    const precio = Number(price);
    if (!Number.isFinite(precio) || precio <= 0) return toast.error("Precio inválido");
    if (subiendo) return toast.error("Espera a que termine de subir la foto");

    try {
      await agregar.mutateAsync({
        name: name.trim(),
        price: precio,
        stock: Math.max(1, Number(stock) || 1),
        imageUrl: imageUrl ?? undefined,
      });
      toast.success(`"${name.trim()}" agregado al Live`);
      limpiar();
      // No se cierra: cargar prendas es una ráfaga, no una a la vez.
      inputFoto.current?.focus();
    } catch (error) {
      toast.error((error as Error).message || "No se pudo agregar");
    }
  };

  const cerrar = (abierto: boolean) => {
    if (!abierto) limpiar();
    onOpenChange(abierto);
  };

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar prenda</DialogTitle>
          <DialogDescription>
            Se guarda y el formulario queda listo para la siguiente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={enviar} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4">
          <input
            ref={inputFoto}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={elegirFoto}
          />

          {preview ? (
            <div className="relative overflow-hidden rounded-lg border">
              <img src={preview} alt="" className="h-48 w-full object-cover" />
              {subiendo && (
                <div className="absolute inset-0 grid place-items-center bg-tinta/40">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setImageUrl(null);
                }}
                className="absolute right-2 top-2 rounded-full bg-tinta/70 p-1 text-white"
                aria-label="Quitar foto"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputFoto.current?.click()}
              className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground hover:border-border-strong hover:bg-muted"
            >
              <Camera className="h-7 w-7" />
              <span className="text-sm">Tomar o elegir foto</span>
            </button>
          )}

          <div className="space-y-2">
            <Label htmlFor="qa-name">Nombre</Label>
            <Input
              id="qa-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Chaqueta vintage"
              maxLength={100}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="qa-price">Precio</Label>
              <Input
                id="qa-price"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="150"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qa-stock">Cantidad</Label>
              <Input
                id="qa-stock"
                type="number"
                inputMode="numeric"
                min="1"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />
            </div>
          </div>

          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => cerrar(false)}>
              Listo
            </Button>
            <Button type="submit" disabled={agregar.isPending || subiendo}>
              {agregar.isPending ? "Agregando..." : "Agregar y seguir"}
              <ImagePlus className="ml-1 h-4 w-4" />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
