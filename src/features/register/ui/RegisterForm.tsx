import { FormEvent, useState } from "react";
import { useAuth } from "@/app/providers/auth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import { Building2, Mail, Phone, Lock, Eye, EyeOff, AlertCircle, Info, Loader2, Check } from "lucide-react";

export default function RegisterForm() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phoneNumber: "",
    countryCode: "+591",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const passwordChecks = {
    length: formData.password.length >= 8,
    hasNumber: /\d/.test(formData.password),
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!passwordChecks.length) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setLoading(true);
    try {
      await register(formData);
      navigate("/onboarding");
    } catch (err: any) {
      setError(err.message || "Error al crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
      <form onSubmit={onSubmit} className="space-y-4 w-full">
        {error && (
          <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 text-destructive px-3 py-2.5 rounded-md text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="name">Nombre del negocio</Label>
            <Tooltip>
              <TooltipTrigger type="button" tabIndex={-1}>
                <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                Es el nombre con el que conocen tu negocio. Lo podrás cambiar luego en la configuración de tu tienda.
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="name"
              type="text"
              autoComplete="organization"
              placeholder="Ej: Boutique Luna"
              value={formData.name}
              onChange={handleChange("name")}
              className="pl-9"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              value={formData.email}
              onChange={handleChange("email")}
              className="pl-9"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Teléfono / WhatsApp</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="71890091"
              value={formData.phoneNumber}
              onChange={handleChange("phoneNumber")}
              className="pl-9"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              value={formData.password}
              onChange={handleChange("password")}
              className="pl-9 pr-10"
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {formData.password.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
              <span className={`flex items-center gap-1 text-xs ${passwordChecks.length ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                <Check className="h-3 w-3" />
                Mínimo 8 caracteres
              </span>
              <span className={`flex items-center gap-1 text-xs ${passwordChecks.hasNumber ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                <Check className="h-3 w-3" />
                Al menos un número
              </span>
            </div>
          )}
        </div>

        <Button type="submit" className="w-full h-11 mt-2" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creando cuenta...
            </>
          ) : (
            "Crear cuenta gratis"
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Al crear una cuenta aceptas nuestros{" "}
          <a href="#" className="text-emerald-600 dark:text-emerald-400 hover:underline">Términos</a>
          {" "}y{" "}
          <a href="#" className="text-emerald-600 dark:text-emerald-400 hover:underline">Privacidad</a>.
        </p>
      </form>
    </TooltipProvider>
  );
}
