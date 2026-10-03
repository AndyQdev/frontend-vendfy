"use client";

import { useState, useEffect } from "react";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogBody as DialogBody,
} from "@/shared/ui/responsive-dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { User, Phone } from "lucide-react";
import { toast } from "sonner";

interface CreateClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { name: string; phone: string }) => Promise<void>;
  isCreating?: boolean;
  initialName?: string;
}

export function CreateClientModal({ 
  open, 
  onOpenChange, 
  onSave, 
  isCreating = false, 
  initialName = "" 
}: CreateClientModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
  });

  // Pre-llenar el nombre cuando se abre el modal
  useEffect(() => {
    if (open && initialName) {
      setFormData(prev => ({ ...prev, name: initialName }));
    } else if (!open) {
      // Limpiar el formulario cuando se cierra el modal
      setFormData({
        name: "",
        phone: "",
      });
    }
  }, [open, initialName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones
    if (!formData.name.trim()) {
      toast.error("El nombre completo es requerido");
      return;
    }

    if (!formData.phone.trim()) {
      toast.error("El teléfono es requerido");
      return;
    }

    // Validar que el teléfono solo contenga números y caracteres permitidos
    if (!/^[\d\s\+\-\(\)]+$/.test(formData.phone)) {
      toast.error("El teléfono contiene caracteres inválidos");
      return;
    }

    try {
      await onSave(formData);
      // Limpiar el formulario después de guardar
      setFormData({
        name: "",
        phone: "",
      });
    } catch (error) {
      console.error("Error al guardar cliente:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="flex items-center justify-center rounded-lg bg-primary/10 p-2">
              <User className="h-5 w-5 text-primary" />
            </div>
            Crear Nuevo Cliente
          </DialogTitle>
          <DialogDescription>
            Complete los datos del nuevo cliente
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4 pt-4">
          {/* Nombre Completo */}
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4 text-muted-foreground" />
              Nombre Completo <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Ej: Juan Pérez"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="h-11"
              required
              maxLength={100}
              disabled={isCreating}
            />
          </div>

          {/* Teléfono/Celular */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2 text-sm font-medium">
              <Phone className="h-4 w-4 text-muted-foreground" />
              Teléfono/Celular <span className="text-destructive">*</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+591 71890091"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="h-11"
              required
              maxLength={20}
              disabled={isCreating}
            />
            <p className="text-xs text-muted-foreground">
              Incluye código de país si es necesario
            </p>
          </div>

          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isCreating || !formData.name.trim() || !formData.phone.trim()}
            >
              {isCreating ? (
                <>
                  <svg
                    className="mr-2 h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    ></path>
                  </svg>
                  Creando...
                </>
              ) : (
                "Crear Cliente"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
