import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogBody as DialogBody,
} from "@/shared/ui/responsive-dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Customer, CreateCustomerInput } from "@/entities/customer/model/types";
import { useCreateCustomer, useUpdateCustomer } from "@/entities/customer/api";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect } from "react";

interface CustomerFormModalProps {
  customer?: Customer | null;
  open: boolean;
  onClose: () => void;
}

const COUNTRIES = [
  { code: "BO", name: "Bolivia", dialCode: "+591" },
  { code: "AR", name: "Argentina", dialCode: "+54" },
  { code: "BR", name: "Brasil", dialCode: "+55" },
  { code: "CL", name: "Chile", dialCode: "+56" },
  { code: "CO", name: "Colombia", dialCode: "+57" },
  { code: "EC", name: "Ecuador", dialCode: "+593" },
  { code: "PY", name: "Paraguay", dialCode: "+595" },
  { code: "PE", name: "Perú", dialCode: "+51" },
  { code: "UY", name: "Uruguay", dialCode: "+598" },
  { code: "VE", name: "Venezuela", dialCode: "+58" },
];

export function CustomerFormModal({ customer, open, onClose }: CustomerFormModalProps) {
  const isEditing = !!customer;
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<CreateCustomerInput>({
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      country: "",
      birthDate: "",
      gender: undefined,
    },
  });

  const selectedCountry = watch("country");
  const selectedGender = watch("gender");

  // Autorellenar formulario cuando hay un customer
  useEffect(() => {
    if (customer && open) {
      reset({
        name: customer.name || "",
        phone: customer.phone || "",
        email: customer.email || "",
        country: customer.country || "",
        birthDate: customer.birthDate || "",
        gender: customer.gender,
      });
    } else if (!customer && open) {
      reset({
        name: "",
        phone: "",
        email: "",
        country: "+591",
        birthDate: "",
        gender: undefined,
      });
    }
  }, [customer, open, reset]);

  const onSubmit = async (data: CreateCustomerInput) => {
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: customer.id, data });
        toast.success("Cliente actualizado correctamente");
      } else {
        await createMutation.mutateAsync(data);
        toast.success("Cliente creado correctamente");
      }
      reset();
      onClose();
    } catch (error) {
      toast.error(isEditing ? "Error al actualizar el cliente" : "Error al crear el cliente");
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            {isEditing ? "Editar Cliente" : "Crear Nuevo Cliente"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4">
          {/* Nombre */}
          <div>
            <Label htmlFor="name">
              Nombre Completo <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              {...register("name", { required: "El nombre es requerido", maxLength: { value: 100, message: "Máximo 100 caracteres" } })}
              placeholder="Ej: Juan Pérez García"
            />
            {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          {/* Teléfono con código de país */}
          <div>
            <Label htmlFor="phone">
              Teléfono <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2">
              <Select value={selectedCountry || "+591"} onValueChange={(value) => setValue("country", value)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Código" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((country) => (
                    <SelectItem key={country.code} value={country.dialCode}>
                      {country.dialCode} {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="phone"
                {...register("phone", { required: "El teléfono es requerido", maxLength: { value: 20, message: "Máximo 20 caracteres" } })}
                placeholder="Ej: 70123456"
                className="flex-1"
              />
            </div>
            {errors.phone && <p className="text-sm text-red-500 mt-1">{errors.phone.message}</p>}
          </div>

          {/* Email */}
          <div>
            <Label htmlFor="email">Email (Opcional)</Label>
            <Input
              id="email"
              type="email"
              {...register("email", {
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Email inválido" },
                maxLength: { value: 100, message: "Máximo 100 caracteres" },
              })}
              placeholder="Ej: juan.perez@example.com"
            />
            {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          {/* Fecha de Nacimiento */}
          <div>
            <Label htmlFor="birthDate">Fecha de Nacimiento (Opcional)</Label>
            <Input
              id="birthDate"
              type="date"
              {...register("birthDate")}
            />
          </div>

          {/* Género */}
          <div>
            <Label htmlFor="gender">Género (Opcional)</Label>
            <Select value={selectedGender || ""} onValueChange={(value) => setValue("gender", value as "male" | "female" | "other")}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un género" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Masculino</SelectItem>
                <SelectItem value="female">Femenino</SelectItem>
                <SelectItem value="other">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          </DialogBody>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending
                ? "Guardando..."
                : isEditing
                ? "Actualizar"
                : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
