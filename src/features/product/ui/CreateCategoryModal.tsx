import { useEffect, useState } from "react";
import { FolderPlus, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { IconPicker } from "@/shared/ui/icon-picker";
import { useCreateCategory, useUpdateCategory } from "@/entities/product/api";
import type { Category } from "@/entities/product/model/types";
import { useAuth } from "@/app/providers/auth";
import { toast } from "sonner";

interface CreateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: Category | null;
}

export function CreateCategoryModal({ isOpen, onClose, category }: CreateCategoryModalProps) {
  const { user } = useAuth();
  const isEditing = !!category;

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    icon: null as string | null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: category?.name ?? "",
        description: category?.description ?? "",
        icon: category?.icon ?? null,
      });
      setErrors({});
    }
  }, [isOpen, category]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = (): boolean => {
    const next: Record<string, string> = {};
    if (!formData.name.trim()) next.name = "El nombre de la categoría es requerido";
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
      if (isEditing && category) {
        await updateCategory.mutateAsync({
          id: category.id,
          data: {
            name: formData.name,
            description: formData.description || undefined,
            icon: formData.icon,
          },
        });
        toast.success("Categoría actualizada");
      } else {
        await createCategory.mutateAsync({
          name: formData.name,
          description: formData.description || undefined,
          icon: formData.icon,
          userId: user.id,
        });
        toast.success("Categoría creada");
      }
      onClose();
    } catch (error) {
      console.error("Error guardando categoría:", error);
      toast.error(isEditing ? "Error al actualizar la categoría" : "Error al crear la categoría");
    }
  };

  const isPending = createCategory.isPending || updateCategory.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-primary" />
            <DialogTitle>{isEditing ? "Editar Categoría" : "Nueva Categoría"}</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="category-name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={errors.name ? "border-destructive" : ""}
              placeholder="Ej: Electrónicos, Ropa, Hogar..."
              maxLength={100}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label>Icono</Label>
            <IconPicker
              value={formData.icon}
              onChange={(icon) => setFormData((prev) => ({ ...prev, icon }))}
            />
            <p className="text-xs text-muted-foreground">
              Se mostrará al lado del nombre en la tienda.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-description">Descripción (opcional)</Label>
            <textarea
              id="category-description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none text-sm"
              placeholder="Describe la categoría..."
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
