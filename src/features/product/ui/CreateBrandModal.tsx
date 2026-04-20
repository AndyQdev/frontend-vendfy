import { useEffect, useState } from "react";
import { Tag, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useCreateBrand, useUpdateBrand } from "@/entities/product/api";
import type { Brand } from "@/entities/product/model/types";
import { useAuth } from "@/app/providers/auth";
import { toast } from "sonner";

interface CreateBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  brand?: Brand | null;
}

export function CreateBrandModal({ isOpen, onClose, brand }: CreateBrandModalProps) {
  const { user } = useAuth();
  const isEditing = !!brand;

  const [formData, setFormData] = useState({ name: "", description: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createBrand = useCreateBrand();
  const updateBrand = useUpdateBrand();

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: brand?.name ?? "",
        description: brand?.description ?? "",
      });
      setErrors({});
    }
  }, [isOpen, brand]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = (): boolean => {
    const next: Record<string, string> = {};
    if (!formData.name.trim()) next.name = "El nombre de la marca es requerido";
    if (formData.name.length > 100) next.name = "El nombre no puede exceder 100 caracteres";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (!user?.id) {
      toast.error("Sesión no válida");
      return;
    }

    try {
      if (isEditing && brand) {
        await updateBrand.mutateAsync({
          id: brand.id,
          data: {
            name: formData.name,
            description: formData.description || undefined,
          },
        });
        toast.success("Marca actualizada");
      } else {
        await createBrand.mutateAsync({
          name: formData.name,
          description: formData.description || undefined,
          userId: user.id,
        });
        toast.success("Marca creada");
      }
      onClose();
    } catch (error) {
      console.error("Error guardando marca:", error);
      toast.error(isEditing ? "Error al actualizar la marca" : "Error al crear la marca");
    }
  };

  const isPending = createBrand.isPending || updateBrand.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            <DialogTitle>{isEditing ? "Editar Marca" : "Nueva Marca"}</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brand-name">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="brand-name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={errors.name ? "border-destructive" : ""}
              placeholder="Ej: Nike, Apple, Samsung..."
              maxLength={100}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand-description">Descripción (opcional)</Label>
            <textarea
              id="brand-description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none text-sm"
              placeholder="Describe la marca..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              <Save className="h-4 w-4 mr-2" />
              {isPending ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
