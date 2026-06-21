import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Store as StoreIcon,
  Palette,
  Phone as PhoneIcon,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  LogOut,
  Upload,
  Trash2,
  Globe,
  Mail,
  MapPin,
  Info,
  Sparkles,
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { AiFieldButton } from "@/shared/ui/ai-field-button";
import { LocationPicker } from "@/shared/ui/LocationPicker";
import { VendfyLogo } from "@/shared/ui/VendfyLogo";

import { useTheme } from "@/app/providers/theme";
import { useAuth } from "@/app/providers/auth";
import { useCreateStore, useUpdateStore } from "@/entities/store/api";
import { apiFetch } from "@/shared/api/client";
import { markOnboardingStep, ONBOARDING_STEPS } from "@/entities/user/api/onboarding";
import type { Store, StoreConfig } from "@/entities/store/model/types";

const TOTAL_STEPS = 3;

const CATEGORIES = [
  { value: "tecnologia", label: "Tecnología", theme: "modern" },
  { value: "moda", label: "Moda", theme: "elegante" },
  { value: "hogar", label: "Hogar", theme: "minimal" },
  { value: "abarrotes", label: "Abarrotes", theme: "minimal" },
  { value: "belleza", label: "Belleza", theme: "classic" },
  { value: "deportes", label: "Deportes", theme: "darkmode" },
  { value: "arte", label: "Arte", theme: "creative" },
];

const CURRENCIES = [
  { value: "BOB", label: "BOB · Bolivianos" },
  { value: "USD", label: "USD · Dólares" },
  { value: "EUR", label: "EUR · Euros" },
];

const COUNTRY_CODES = [
  { value: "591", label: "🇧🇴 +591" },
  { value: "54", label: "🇦🇷 +54" },
  { value: "56", label: "🇨🇱 +56" },
  { value: "57", label: "🇨🇴 +57" },
  { value: "593", label: "🇪🇨 +593" },
  { value: "51", label: "🇵🇪 +51" },
  { value: "52", label: "🇲🇽 +52" },
  { value: "1", label: "🇺🇸 +1" },
  { value: "34", label: "🇪🇸 +34" },
];

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

interface FormState {
  name: string;
  slug: string;
  description: string;
  category: string;
  currency: string;
  themeId: string;
  logoUrl: string;
  bannerUrl: string;
  heroTitle: string;
  phoneCountryCode: string;
  phoneNumber: string;
  email: string;
  city: string;
  address: string;
  coordinates: { latitude: number; longitude: number } | null;
  facebookUrl: string;
  instagramUrl: string;
}

const initialState: FormState = {
  name: "",
  slug: "",
  description: "",
  category: "",
  currency: "BOB",
  themeId: "",
  logoUrl: "",
  bannerUrl: "",
  heroTitle: "",
  phoneCountryCode: "591",
  phoneNumber: "",
  email: "",
  city: "",
  address: "",
  coordinates: null,
  facebookUrl: "",
  instagramUrl: "",
};

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const { theme } = useTheme();
  const resolvedDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const createStore = useCreateStore();
  const updateStore = useUpdateStore();

  const [step, setStep] = useState(1);
  const [data, setData] = useState<FormState>(initialState);
  const [createdStore, setCreatedStore] = useState<Store | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Pre-rellenar email con el del user al iniciar
  useEffect(() => {
    if (user?.email && !data.email) {
      setData((prev) => ({ ...prev, email: user.email }));
    }
    if (user?.phoneNumber && !data.phoneNumber) {
      setData((prev) => ({
        ...prev,
        phoneNumber: user.phoneNumber || "",
        phoneCountryCode: user.countryCode?.replace("+", "") || "591",
      }));
    }
  }, [user]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

  const aiContext = useMemo(
    () => ({
      name: data.name,
      slug: data.slug,
      description: data.description,
      category: data.category,
      heroTitle: data.heroTitle,
      city: data.city,
    }),
    [data],
  );

  const buildConfig = (): StoreConfig => ({
    branding: {
      logoUrl: data.logoUrl || undefined,
      bannerUrl: data.bannerUrl || undefined,
      heroTitle: data.heroTitle || undefined,
    },
    contact: {
      phone: data.phoneNumber ? `${data.phoneCountryCode}-${data.phoneNumber}` : undefined,
      email: data.email || undefined,
      city: data.city || undefined,
      address: data.address || undefined,
      coordinates: data.coordinates || undefined,
    },
    socialMedia: {
      facebookUrl: data.facebookUrl || undefined,
      instagramUrl: data.instagramUrl || undefined,
    },
    delivery: { type: "pending", value: 0 },
    category: data.category || undefined,
    themeId: data.themeId || undefined,
    currency: data.currency,
  });

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("image", file);
    const response = await apiFetch<{ url: string }>("/api/product/upload-image", {
      method: "POST",
      body: formData,
    });
    if (!response.data?.url) throw new Error("No se pudo subir la imagen");
    return response.data.url;
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingLogo(true);
      const url = await uploadImage(file);
      update("logoUrl", url);
      toast.success("Logo subido");
    } catch {
      toast.error("Error al subir el logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingBanner(true);
      const url = await uploadImage(file);
      update("bannerUrl", url);
      toast.success("Banner subido");
    } catch {
      toast.error("Error al subir el banner");
    } finally {
      setUploadingBanner(false);
    }
  };

  // ====== Validaciones por paso ======
  const validateStep1 = () => {
    if (!data.name.trim()) {
      toast.error("Ponle un nombre a tu tienda");
      return false;
    }
    if (data.name.trim().length < 3) {
      toast.error("El nombre debe tener al menos 3 caracteres");
      return false;
    }
    if (!data.slug.trim()) {
      toast.error("La URL de tu tienda no puede estar vacía");
      return false;
    }
    if (!data.category) {
      toast.error("Elige la categoría que mejor describe tu negocio");
      return false;
    }
    return true;
  };

  // ====== Navegación / submit ======
  const goNext = async () => {
    if (step === 1) {
      if (!validateStep1()) return;
      // Si todavía no creamos la tienda, la creamos al pasar de paso 1
      if (!createdStore) {
        try {
          setSubmitting(true);
          const created = await createStore.mutateAsync({
            name: data.name.trim(),
            slug: data.slug.trim(),
            description: data.description.trim() || undefined,
            config: buildConfig(),
          });
          setCreatedStore(created);
          toast.success("¡Tu tienda fue creada!");
        } catch (err: any) {
          const msg = err?.message?.toLowerCase().includes("slug")
            ? "Esa URL ya está en uso, prueba otra"
            : "No pudimos crear tu tienda. Intenta de nuevo";
          toast.error(msg);
          return;
        } finally {
          setSubmitting(false);
        }
      } else {
        // Si ya existe, actualizamos los datos del paso 1
        try {
          setSubmitting(true);
          const updated = await updateStore.mutateAsync({
            id: createdStore.id,
            data: {
              name: data.name.trim(),
              slug: data.slug.trim(),
              description: data.description.trim() || undefined,
              config: buildConfig(),
            },
          });
          setCreatedStore(updated);
        } catch {
          toast.error("No pudimos actualizar los datos");
          return;
        } finally {
          setSubmitting(false);
        }
      }
    }

    if (step === 2 && createdStore) {
      try {
        setSubmitting(true);
        const updated = await updateStore.mutateAsync({
          id: createdStore.id,
          data: { config: buildConfig() },
        });
        setCreatedStore(updated);
      } catch {
        toast.error("No pudimos guardar el branding");
        return;
      } finally {
        setSubmitting(false);
      }
    }

    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const finishOnboarding = async (saveContact: boolean) => {
    if (!createdStore) {
      toast.error("Primero termina el paso 1");
      setStep(1);
      return;
    }
    try {
      setSubmitting(true);
      if (saveContact) {
        await updateStore.mutateAsync({
          id: createdStore.id,
          data: { config: buildConfig() },
        });
      }
      await apiFetch("/api/user/finish-onboarding", { method: "POST" });
      // Marcar pasos 1 (tienda creada) y 5 (personalización) automáticamente
      await markOnboardingStep(ONBOARDING_STEPS.STORE_CREATED);
      if (data.logoUrl || data.bannerUrl || data.heroTitle) {
        await markOnboardingStep(ONBOARDING_STEPS.STORE_PERSONALIZED);
      }
      await refreshUser();
      toast.success("¡Tu tienda está lista! Ahora agreguemos tu primer producto 🎉");
      navigate("/products?welcome=1", { replace: true });
    } catch {
      toast.error("No pudimos finalizar. Intenta de nuevo");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Topbar minimal */}
        <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
            <VendfyLogo variant={resolvedDark ? "full-white" : "full"} size={32} />
            <button
              onClick={handleLogout}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Cerrar sesión
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-8 lg:py-12">
          {/* Bienvenida (solo paso 1) */}
          {step === 1 && (
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full mb-4">
                <Sparkles className="h-3 w-3" />
                Configuremos tu tienda en 3 pasos
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Hola{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
              </h1>
              <p className="text-muted-foreground mt-2">
                Empecemos por lo esencial. Esto tomará menos de 5 minutos.
              </p>
            </div>
          )}

          {/* Stepper */}
          <Stepper currentStep={step} />

          {/* Paneles por paso */}
          <div className="mt-8 bg-card border border-border rounded-xl shadow-sm p-6 lg:p-8">
            {step === 1 && (
              <Step1
                data={data}
                update={update}
                aiContext={aiContext}
              />
            )}
            {step === 2 && (
              <Step2
                data={data}
                update={update}
                aiContext={aiContext}
                onLogoClick={() => logoInputRef.current?.click()}
                onBannerClick={() => bannerInputRef.current?.click()}
                uploadingLogo={uploadingLogo}
                uploadingBanner={uploadingBanner}
              />
            )}
            {step === 3 && <Step3 data={data} update={update} />}

            {/* Inputs ocultos para upload */}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              onChange={handleBannerUpload}
              className="hidden"
            />
          </div>

          {/* Footer de navegación */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={goBack}
              disabled={step === 1 || submitting}
            >
              <ChevronLeft className="h-4 w-4" />
              Atrás
            </Button>

            <div className="flex items-center gap-2">
              {step > 1 && step < TOTAL_STEPS && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={goNext}
                  disabled={submitting}
                  className="text-muted-foreground"
                >
                  Saltar por ahora
                </Button>
              )}
              {step === TOTAL_STEPS && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => finishOnboarding(false)}
                  disabled={submitting}
                  className="text-muted-foreground"
                >
                  Saltar y terminar
                </Button>
              )}

              {step < TOTAL_STEPS ? (
                <Button type="button" onClick={goNext} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Continuar
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => finishOnboarding(true)}
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Finalizar y entrar
                </Button>
              )}
            </div>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

// ===================== Stepper =====================
function Stepper({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: "Lo esencial", icon: StoreIcon },
    { num: 2, label: "Identidad visual", icon: Palette },
    { num: 3, label: "Contacto", icon: PhoneIcon },
  ];

  return (
    <div className="flex items-center justify-between max-w-xl mx-auto">
      {steps.map((s, i) => {
        const Icon = s.icon;
        const completed = currentStep > s.num;
        const active = currentStep === s.num;
        return (
          <div key={s.num} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center transition-all border-2 ${
                  completed
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : active
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-600 text-emerald-700 dark:text-emerald-300"
                      : "bg-muted border-border text-muted-foreground"
                }`}
              >
                {completed ? <Check className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
              </div>
              <span
                className={`text-xs font-medium ${
                  active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 -mt-6 ${
                  currentStep > s.num ? "bg-emerald-600" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ===================== Field helper =====================
function FieldLabel({
  htmlFor,
  children,
  hint,
  rightSlot,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <Label htmlFor={htmlFor}>{children}</Label>
      {hint && (
        <Tooltip>
          <TooltipTrigger type="button" tabIndex={-1}>
            <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            {hint}
          </TooltipContent>
        </Tooltip>
      )}
      {rightSlot && <div className="ml-auto">{rightSlot}</div>}
    </div>
  );
}

// ===================== Paso 1 =====================
function Step1({
  data,
  update,
  aiContext,
}: {
  data: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  aiContext: Record<string, any>;
}) {
  const publicUrl =
    (import.meta.env.VITE_URL_PUBLIC as string) || "https://compras.vendfy.shop";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Cuéntanos sobre tu tienda</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Estos datos identifican a tu negocio frente a tus clientes.
        </p>
      </div>

      <div>
        <FieldLabel
          htmlFor="store-name"
          hint="Es el nombre que verán tus clientes en la tienda online y en los recibos."
        >
          Nombre de la tienda
        </FieldLabel>
        <Input
          id="store-name"
          value={data.name}
          placeholder="Ej: Boutique Luna"
          onChange={(e) => {
            const value = e.target.value;
            update("name", value);
            // auto-slug solo si el slug aún no fue editado manualmente o coincide con el slug previo
            update("slug", slugify(value));
          }}
        />
      </div>

      <div>
        <FieldLabel
          htmlFor="store-slug"
          hint="Es la dirección web de tu tienda. Solo letras minúsculas, números y guiones."
        >
          URL de tu tienda
        </FieldLabel>
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md border border-border">
          <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm text-muted-foreground truncate">{publicUrl}/</span>
          <Input
            id="store-slug"
            value={data.slug}
            placeholder="mi-tienda"
            onChange={(e) => update("slug", slugify(e.target.value))}
            className="border-0 shadow-none p-0 h-auto bg-transparent focus-visible:ring-0 text-sm"
          />
        </div>
        {data.slug && (
          <p className="text-xs text-muted-foreground mt-1.5">
            Tu tienda estará en{" "}
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {publicUrl}/{data.slug}
            </span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel
            htmlFor="store-category"
            hint="Define qué tipo de productos vendes y nos ayuda a sugerir el mejor diseño."
          >
            Categoría
          </FieldLabel>
          <Select
            value={data.category}
            onValueChange={(value) => {
              update("category", value);
              const cat = CATEGORIES.find((c) => c.value === value);
              if (cat && !data.themeId) update("themeId", cat.theme);
            }}
          >
            <SelectTrigger id="store-category">
              <SelectValue placeholder="¿Qué vendes?" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <FieldLabel
            htmlFor="store-currency"
            hint="Moneda en la que mostrarás tus precios. Puedes cambiarla luego."
          >
            Moneda
          </FieldLabel>
          <Select value={data.currency} onValueChange={(value) => update("currency", value)}>
            <SelectTrigger id="store-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <FieldLabel
          htmlFor="store-description"
          hint="Una frase corta que aparecerá en tu tienda y al compartirla en redes."
          rightSlot={
            <AiFieldButton
              field="store_description"
              currentValues={aiContext}
              onResult={(value) => update("description", value)}
              skipNameCheck
            />
          }
        >
          Descripción breve
        </FieldLabel>
        <Textarea
          id="store-description"
          value={data.description}
          onChange={(e) => update("description", e.target.value)}
          rows={3}
          placeholder="Ej: Ropa femenina con estilo, hecha en Bolivia. Envíos a todo el país."
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          💡 Pulsa <span className="font-medium">IA</span> para que te ayudemos a redactarla.
        </p>
      </div>
    </div>
  );
}

// ===================== Paso 2 =====================
function Step2({
  data,
  update,
  aiContext,
  onLogoClick,
  onBannerClick,
  uploadingLogo,
  uploadingBanner,
}: {
  data: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  aiContext: Record<string, any>;
  onLogoClick: () => void;
  onBannerClick: () => void;
  uploadingLogo: boolean;
  uploadingBanner: boolean;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Dale identidad a tu tienda</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Sube tu logo y un banner. Si no los tienes ahora, puedes saltar este paso.
        </p>
      </div>

      {/* Banner + Logo combinado */}
      <div>
        <FieldLabel hint="El banner es la imagen grande que aparece arriba de tu tienda. Recomendamos 1920x600 px.">
          Banner y logo
        </FieldLabel>
        <div
          onClick={onBannerClick}
          className="relative w-full h-56 bg-gradient-to-br from-muted/50 to-muted rounded-lg overflow-hidden border-2 border-dashed border-border hover:border-emerald-500 transition-colors cursor-pointer group"
        >
          {data.bannerUrl ? (
            <img
              src={data.bannerUrl}
              alt="Banner"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Upload className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">
                  {uploadingBanner ? "Subiendo banner..." : "Click para subir banner"}
                </p>
                <p className="text-xs opacity-70">JPG, PNG · 1920x600 px</p>
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />

          {data.bannerUrl && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-3 right-3 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                update("bannerUrl", "");
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}

          {data.heroTitle && (
            <div className="absolute bottom-5 left-0 right-0 text-center pointer-events-none px-4">
              <h2 className="text-xl font-bold text-white drop-shadow-lg">{data.heroTitle}</h2>
            </div>
          )}

          <div
            className="absolute bottom-4 left-4 cursor-pointer group/logo"
            onClick={(e) => {
              e.stopPropagation();
              onLogoClick();
            }}
          >
            {data.logoUrl ? (
              <div className="relative">
                <div className="bg-white/95 dark:bg-gray-900/95 p-2.5 rounded-lg shadow-xl group-hover/logo:shadow-emerald-500/40 transition-shadow">
                  <img src={data.logoUrl} alt="Logo" className="h-12 w-auto object-contain" />
                </div>
                <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity">
                  <Upload className="h-5 w-5 text-white" />
                </div>
              </div>
            ) : (
              <div className="bg-white/95 dark:bg-gray-900/95 p-3 rounded-lg shadow-xl">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <StoreIcon className="h-5 w-5" />
                  <span className="text-xs">{uploadingLogo ? "Subiendo..." : "Click para subir logo"}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          💡 Click en el fondo para cambiar el banner. Click en el logo para subirlo.
        </p>
      </div>

      {/* Tema */}
      <div>
        <FieldLabel
          htmlFor="store-theme"
          hint="El tema define los colores y estilo visual de tu tienda. Lo puedes cambiar luego."
        >
          Tema visual
        </FieldLabel>
        <Select value={data.themeId} onValueChange={(value) => update("themeId", value)}>
          <SelectTrigger id="store-theme">
            <SelectValue placeholder="Elige un tema" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="modern">Modern · Tech moderno</SelectItem>
            <SelectItem value="elegante">Elegante · Fashion sofisticado</SelectItem>
            <SelectItem value="minimal">Minimal · Limpio y simple</SelectItem>
            <SelectItem value="classic">Classic · Clásico elegante</SelectItem>
            <SelectItem value="darkmode">Dark Mode · Oscuro deportivo</SelectItem>
            <SelectItem value="creative">Creative · Artístico</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Hero title */}
      <div>
        <FieldLabel
          htmlFor="store-hero"
          hint="Frase llamativa que aparece sobre el banner. Atrae a tus visitantes."
          rightSlot={
            <AiFieldButton
              field="store_heroTitle"
              currentValues={aiContext}
              onResult={(value) => update("heroTitle", value)}
              skipNameCheck
            />
          }
        >
          Título del banner
        </FieldLabel>
        <Input
          id="store-hero"
          value={data.heroTitle}
          onChange={(e) => update("heroTitle", e.target.value)}
          placeholder="Ej: Estilo único, hecho en Bolivia"
        />
      </div>
    </div>
  );
}

// ===================== Paso 3 =====================
function Step3({
  data,
  update,
}: {
  data: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">¿Cómo te contactan tus clientes?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Esta información aparecerá en tu tienda online. Puedes editarla después.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel
            htmlFor="contact-phone"
            hint="Tus clientes podrán escribirte por WhatsApp directo desde la tienda."
          >
            Teléfono / WhatsApp
          </FieldLabel>
          <div className="flex gap-2">
            <Select
              value={data.phoneCountryCode}
              onValueChange={(value) => update("phoneCountryCode", value)}
            >
              <SelectTrigger className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRY_CODES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              id="contact-phone"
              value={data.phoneNumber}
              onChange={(e) => update("phoneNumber", e.target.value)}
              placeholder="71890091"
              className="flex-1"
            />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="contact-email">Email de contacto</FieldLabel>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="contact-email"
              type="email"
              value={data.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="contacto@tutienda.com"
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="contact-city">Ciudad</FieldLabel>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="contact-city"
            value={data.city}
            onChange={(e) => update("city", e.target.value)}
            placeholder="La Paz"
            className="pl-9"
          />
        </div>
      </div>

      <div>
        <FieldLabel hint="Si tienes local físico, marca el punto exacto. Sirve para calcular envíos por distancia.">
          Ubicación de tu tienda (opcional)
        </FieldLabel>
        <LocationPicker
          address={data.address}
          coordinates={{
            lat: data.coordinates?.latitude || 0,
            lng: data.coordinates?.longitude || 0,
          }}
          onAddressChange={(address) => update("address", address)}
          onLocationChange={(loc) =>
            update("coordinates", { latitude: loc.lat, longitude: loc.lng })
          }
          theme="classic"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
        <div>
          <FieldLabel htmlFor="contact-fb">Facebook (opcional)</FieldLabel>
          <Input
            id="contact-fb"
            value={data.facebookUrl}
            onChange={(e) => update("facebookUrl", e.target.value)}
            placeholder="https://facebook.com/tutienda"
          />
        </div>
        <div>
          <FieldLabel htmlFor="contact-ig">Instagram (opcional)</FieldLabel>
          <Input
            id="contact-ig"
            value={data.instagramUrl}
            onChange={(e) => update("instagramUrl", e.target.value)}
            placeholder="https://instagram.com/tutienda"
          />
        </div>
      </div>
    </div>
  );
}
