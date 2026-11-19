import { ElegirFuenteDolar } from "@/entities/exchange-rate/ui/dolar";
import { useState, useEffect, useRef, useMemo } from "react";
import { Save, Store as StoreIcon, Eye, Palette, Phone, Star, Globe, Settings, Plus, X, CheckCircle, Upload, Trash2, Sparkles, History } from "lucide-react";
import { AiFieldButton } from "@/shared/ui/ai-field-button";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Card } from "@/shared/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { useUpdateStore, useCreateStore } from "@/entities/store/api";
import { StoreReviewsManager } from "./StoreReviewsManager";
import { WebConTuIa } from "./WebConTuIa";
import { DisenoTienda } from "./diseno/DisenoTienda";

/** Los mismos del alta de la tienda. */
const RUBROS = [
  { value: "tecnologia", label: "Tecnología" },
  { value: "moda", label: "Moda" },
  { value: "hogar", label: "Hogar" },
  { value: "abarrotes", label: "Abarrotes" },
  { value: "belleza", label: "Belleza" },
  { value: "deportes", label: "Deportes" },
  { value: "arte", label: "Arte" },
];
import { disenoDe, useBorradorDiseno } from "../model/borrador-diseno";
import { subirImagenDeTienda } from "../model/subir-imagen-tienda";
import { useCategories } from "@/entities/product/api";
import { apiFetch } from "@/shared/api/client";
import type { Store, StoreConfig } from "@/entities/store/model/types";
import { toast } from "sonner";
import { LocationPicker } from "@/shared/ui/LocationPicker";
import { useNavigate } from "react-router-dom";
import { useAcceso } from "@/app/providers/acceso";
import { PERMISO } from "@/shared/acceso/permisos";

interface StoreConfigFormProps {
  store?: Store;
  mode?: "create" | "edit";
  onUpdate?: () => void;
}

const emptyStore: Store = {
  id: "",
  name: "",
  slug: "",
  description: "",
  config: {},
  created_at: "",
  updated_at: "",
  enabled: true,
};

export function StoreConfigForm({ store, mode = "edit", onUpdate }: StoreConfigFormProps) {
  const navigate = useNavigate();
  const puedeGuardar = useAcceso().puede(PERMISO.GESTIONAR_TIENDAS);
  const [formData, setFormData] = useState<Store>(store || emptyStore);
  const [isEditing, setIsEditing] = useState(mode === "create");
  const [showSuccess, setShowSuccess] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [seccionDiseno, setSeccionDiseno] = useState<'temas' | 'ia'>('temas');
  const [pestana, setPestana] = useState("general");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Estados para el teléfono con código de país
  const [phoneCountryCode, setPhoneCountryCode] = useState("591");
  const [phoneNumber, setPhoneNumber] = useState("");

  const updateStore = useUpdateStore();
  const createStore = useCreateStore();
  // Para elegir a qué categoría lleva el botón de una imagen de portada.
  const { data: categoriasTienda = [] } = useCategories(store?.id || undefined);

  // Lo guardado, en el formulario. También es "Descartar cambios".
  const cargarGuardado = () => {
    if (store) setFormData(store);

    // Extraer código de país y número del teléfono almacenado
    const storedPhone = store?.config?.contact?.phone || "";
    if (storedPhone.includes("-")) {
      const [code, number] = storedPhone.split("-");
      setPhoneCountryCode(code);
      setPhoneNumber(number);
    } else {
      setPhoneNumber(storedPhone);
    }
  };
  useEffect(() => cargarGuardado(), [store]);

  // El diseño sin guardar sobrevive a salir de la pantalla (model/borrador-diseno.ts).
  const borradorDiseno = useBorradorDiseno(
    mode === "edit" ? store?.id : undefined,
    disenoDe(store?.config),
    disenoDe(formData.config),
  );
  const recuperarDiseno = () => {
    const diseno = borradorDiseno.recuperar();
    if (!diseno) return;
    setFormData((prev) => ({ ...prev, config: { ...prev.config, ...diseno } }));
    setIsEditing(true);
    setSeccionDiseno("temas");
    setPestana("design");
  };
  const descartarCambios = () => {
    cargarGuardado();
    setIsEditing(false);
  };

  // Cerrar o recargar la pestaña con cambios: el navegador pregunta. Navegar
  // dentro del panel no se puede frenar con BrowserRouter; el diseño, igual,
  // queda en el borrador.
  useEffect(() => {
    if (mode !== "edit" || !isEditing) return;
    const alSalir = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", alSalir);
    return () => window.removeEventListener("beforeunload", alSalir);
  }, [mode, isEditing]);

  // Context for AI buttons - all current store form values
  const storeAiContext = useMemo(() => ({
    name: formData.name,
    slug: formData.slug,
    description: formData.description,
    category: formData.config?.category,
    aboutUs: formData.config?.aboutUs,
    heroTitle: formData.config?.branding?.heroTitle,
    city: formData.config?.contact?.city,
  }), [formData]);

  const handleInputChange = (field: keyof Store, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsEditing(true);
  };

  const handleConfigChange = (section: keyof StoreConfig, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [section]: {
          ...(prev.config?.[section] as any),
          [field]: value
        }
      }
    }));
    setIsEditing(true);
  };

  // Para campos de primer nivel en config (category, themeId, currency, aboutUs)
  const handleConfigFieldChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [field]: value
      }
    }));
    setIsEditing(true);
  };

  const isSaving = updateStore.isPending || createStore.isPending;

  const handleSave = async () => {
    if (mode === "create") {
      if (!formData.name.trim() || !formData.slug.trim()) {
        toast.error("El nombre y el slug son obligatorios");
        return;
      }
      try {
        const created = await createStore.mutateAsync({
          name: formData.name,
          slug: formData.slug,
          description: formData.description,
          config: formData.config,
        });
        toast.success("Tienda creada correctamente");
        navigate(`/stores/${created.id}`);
      } catch (error: any) {
        console.error("Error creating store:", error);
        const msg = error?.message?.includes("slug") ? "El slug ya existe, elige otro" : "Error al crear la tienda";
        toast.error(msg);
      }
    } else {
      try {
        await updateStore.mutateAsync({ id: store!.id, data: formData });
        setIsEditing(false);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        onUpdate?.();
        toast.success("Tienda actualizada correctamente");
      } catch (error) {
        console.error("Error updating store:", error);
        toast.error("Error al actualizar la tienda");
      }
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("image", file);

    const response = await apiFetch<{ url: string; path: string }>("/api/product/upload-image", {
      method: "POST",
      body: formData
    });

    if (response.data?.url) {
      return response.data.url;
    }

    throw new Error("Error al subir la imagen");
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      const url = await uploadImage(file);
      handleConfigChange("branding", "logoUrl", url);
      toast.success("Logo subido correctamente");
    } catch (error) {
      console.error("Error uploading logo:", error);
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
      handleConfigChange("branding", "bannerUrl", url);
      toast.success("Banner subido correctamente");
    } catch (error) {
      console.error("Error uploading banner:", error);
      toast.error("Error al subir el banner");
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleRemoveLogo = () => {
    handleConfigChange("branding", "logoUrl", "");
  };

  const handleRemoveBanner = () => {
    handleConfigChange("branding", "bannerUrl", "");
  };


  const currencies = [
    { value: "BOB", label: "BOB - Bolivianos" },
    { value: "USD", label: "USD - Dólares" },
    { value: "EUR", label: "EUR - Euros" }
  ];

  // Códigos de país para teléfono
  const countryCodes = [
    { value: "591", label: "🇧🇴 +591", country: "Bolivia" },
    { value: "54", label: "🇦🇷 +54", country: "Argentina" },
    { value: "56", label: "🇨🇱 +56", country: "Chile" },
    { value: "57", label: "🇨🇴 +57", country: "Colombia" },
    { value: "593", label: "🇪🇨 +593", country: "Ecuador" },
    { value: "51", label: "🇵🇪 +51", country: "Perú" },
    { value: "52", label: "🇲🇽 +52", country: "México" },
    { value: "1", label: "🇺🇸 +1", country: "USA" },
    { value: "34", label: "🇪🇸 +34", country: "España" },
  ];

  // Manejar cambio de código de país
  const handlePhoneCountryCodeChange = (code: string) => {
    setPhoneCountryCode(code);
    const fullPhone = phoneNumber ? `${code}-${phoneNumber}` : "";
    handleConfigChange("contact", "phone", fullPhone);
  };

  // Manejar cambio de número de teléfono
  const handlePhoneNumberChange = (number: string) => {
    setPhoneNumber(number);
    const fullPhone = number ? `${phoneCountryCode}-${number}` : "";
    handleConfigChange("contact", "phone", fullPhone);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="titulo-pagina">
            {mode === "create" ? "Crear Nueva Tienda" : "Configuración de Tienda"}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {mode === "create" ? "Completa los datos para crear tu nueva tienda" : "Personaliza todos los aspectos de tu tienda online"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {showSuccess && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Guardado exitosamente</span>
            </div>
          )}
          {mode === "edit" && isEditing && !isSaving && (
            <Button variant="ghost" onClick={descartarCambios}>
              Descartar cambios
            </Button>
          )}
          {!puedeGuardar ? (
            <span className="text-xs text-muted-foreground">Solo lectura: tu rol no puede cambiar la tienda.</span>
          ) : null}
          <Button onClick={handleSave} disabled={!puedeGuardar || !isEditing || isSaving}>
            {isSaving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isSaving ? "Guardando..." : mode === "create" ? "Crear Tienda" : "Guardar Cambios"}
          </Button>
        </div>
      </div>

      {/* Status Card */}
      {/* <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <StoreIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{formData.name}</h2>
              <p className="text-sm text-muted-foreground">@{formData.slug}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${formData.enabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            <span className={`text-sm ${formData.enabled ? 'text-green-600' : 'text-gray-500'}`}>
              {formData.enabled ? "Activa" : "Inactiva"}
            </span>
          </div>
        </div>
      </Card> */}

      {borradorDiseno.pendiente && (
        <Card className="flex flex-wrap items-center gap-3 border-amber-500/40 bg-amber-500/10 p-4">
          <History className="h-5 w-5 flex-none text-amber-600" />
          <p className="min-w-0 flex-1 text-sm">
            Tienes cambios de diseño sin guardar (
            {new Date(borradorDiseno.pendiente.fecha).toLocaleString("es-BO", {
              day: "numeric",
              month: "long",
              hour: "numeric",
              minute: "2-digit",
            })}
            ). ¿Los recuperas para seguir?
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={borradorDiseno.descartar}>
              Descartar
            </Button>
            <Button size="sm" onClick={recuperarDiseno}>
              Recuperar
            </Button>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={pestana} onValueChange={setPestana} className="w-full">
        <TabsList className={`grid w-full ${mode === "edit" && store?.id ? "grid-cols-5" : "grid-cols-4"}`}>
          <TabsTrigger value="general" className="text-xs md:text-sm">
            <Settings className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="branding" className="text-xs md:text-sm">
            <Upload className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Branding</span>
          </TabsTrigger>
          <TabsTrigger value="contact" className="text-xs md:text-sm">
            <Phone className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Contacto</span>
          </TabsTrigger>
          <TabsTrigger value="design" className="text-xs md:text-sm">
            <Palette className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Diseño</span>
          </TabsTrigger>
          {mode === "edit" && store?.id && (
            <TabsTrigger value="reviews" className="text-xs md:text-sm">
              <Star className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Reseñas</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          <Card className="p-6 space-y-4">
            <h3 className="text-lg font-semibold">Información Básica</h3>
            
            <div>
              <Label htmlFor="name">Nombre de la Tienda</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  handleInputChange("name", e.target.value);
                  if (mode === "create") {
                    const slug = e.target.value
                      .toLowerCase()
                      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, "");
                    handleInputChange("slug", slug);
                  }
                }}
                placeholder="Mi Tienda"
              />
            </div>

            {formData.slug && (
              <div>
                <Label className="text-xs text-muted-foreground">Tu tienda web</Label>
                <div className="flex items-center gap-2 mt-1 px-3 py-2 bg-muted/50 rounded-lg border">
                  <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <a
                    href={`${import.meta.env.VITE_URL_PUBLIC || 'https://compras.vendfy.shop'}/${formData.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline truncate"
                  >
                    {import.meta.env.VITE_URL_PUBLIC || 'https://compras.vendfy.shop'}/{formData.slug}
                  </a>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-1">
                <Label htmlFor="description">Descripción</Label>
                <AiFieldButton
                  field="store_description"
                  currentValues={storeAiContext}
                  onResult={(value) => { handleInputChange("description", value); }}
                  skipNameCheck
                />
              </div>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) => handleInputChange("description", e.target.value)}
                rows={4}
                placeholder="Describe tu tienda..."
              />
            </div>

            <div>
              <Label htmlFor="rubro">Rubro</Label>
              <Select
                value={formData.config?.category || ""}
                onValueChange={(value) => handleConfigFieldChange("category", value)}
              >
                <SelectTrigger id="rubro">
                  <SelectValue placeholder="Elige el rubro de tu tienda" />
                </SelectTrigger>
                <SelectContent>
                  {RUBROS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="currency">Moneda</Label>
              <Select
                value={formData.config?.currency || "BOB"}
                onValueChange={(value) => handleConfigFieldChange("currency", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((curr) => (
                    <SelectItem key={curr.value} value={curr.value}>
                      {curr.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(formData.config?.currency || "BOB") === "BOB" && (
              <div className="space-y-2">
                <div>
                  <Label>Dólar</Label>
                  <p className="text-xs text-muted-foreground">
                    Para comprar y cobrar en dólares. Se actualiza solo cada mañana, y en cada compra o cobro se puede
                    corregir a mano.
                  </p>
                </div>
                <ElegirFuenteDolar
                  storeId={store?.id}
                  valor={formData.config?.exchangeRate?.source ?? "bcb"}
                  onCambio={(source) => handleConfigFieldChange("exchangeRate", { source })}
                />
              </div>
            )}

            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium">Configuración de Envío</h4>
              
              <div>
                <Label htmlFor="deliveryType">Tipo de Envío</Label>
                <Select
                  value={formData.config?.delivery?.type || "pending"}
                  onValueChange={(value: 'pending' | 'free' | 'fixed' | 'calculated') => {
                    // Establecer valor por defecto según el tipo
                    const defaultValue = value === 'free' ? 0 : 
                                       value === 'fixed' ? (formData.config?.delivery?.value || 10) : 
                                       0;
                    handleConfigChange("delivery", "type", value);
                    handleConfigChange("delivery", "value", defaultValue);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tipo de envío" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Por Definir</SelectItem>
                    <SelectItem value="free">Gratis</SelectItem>
                    <SelectItem value="fixed">Valor Fijo</SelectItem>
                    <SelectItem value="calculated">Calculado (Por Distancia)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.config?.delivery?.type === 'pending' && 'El costo de envío se definirá más adelante'}
                  {formData.config?.delivery?.type === 'free' && 'No se cobrará por el envío'}
                  {formData.config?.delivery?.type === 'fixed' && 'Se aplicará un costo fijo a todos los pedidos'}
                  {formData.config?.delivery?.type === 'calculated' && 'El costo se calculará automáticamente según la distancia'}
                </p>
              </div>

              {/* Campo de valor fijo - solo visible cuando type es "fixed" */}
              {formData.config?.delivery?.type === 'fixed' && (
                <div>
                  <Label htmlFor="deliveryValue">Costo de Envío ({formData.config?.currency || 'BOB'})</Label>
                  <Input
                    id="deliveryValue"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.config?.delivery?.value || 0}
                    onChange={(e) => handleConfigChange("delivery", "value", parseFloat(e.target.value) || 0)}
                    placeholder="Ej: 10.00"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Este monto se sumará al total de cada pedido
                  </p>
                </div>
              )}

              {/* Información adicional para tipo calculado */}
              {formData.config?.delivery?.type === 'calculated' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <div className="text-blue-600 mt-0.5">ℹ️</div>
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">Cálculo Automático por Distancia</p>
                      <p className="text-xs text-blue-700">
                        El sistema calculará el costo de envío usando la fórmula: <br />
                        <code className="bg-blue-100 px-1 py-0.5 rounded">Costo Base (10 {formData.config?.currency || 'BOB'}) + (Distancia en km × 2 {formData.config?.currency || 'BOB'})</code>
                      </p>
                      <p className="text-xs text-blue-700 mt-2">
                        💡 Asegúrate de haber configurado la ubicación de tu tienda en la pestaña "Contacto"
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <Label htmlFor="aboutUs">Sobre Nosotros</Label>
                <AiFieldButton
                  field="store_aboutUs"
                  currentValues={storeAiContext}
                  onResult={(value) => { handleConfigFieldChange("aboutUs", value); }}
                  skipNameCheck
                />
              </div>
              <Textarea
                id="aboutUs"
                value={formData.config?.aboutUs || ""}
                onChange={(e) => handleConfigFieldChange("aboutUs", e.target.value)}
                rows={6}
                placeholder="Cuéntanos sobre tu tienda, tu historia, valores..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Esta información aparecerá en la sección "Acerca de" de tu tienda
              </p>
            </div>
          </Card>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="design" className="space-y-6">
          {/* Dos caminos para la web: el tema de Vendfy (lo que viene por
              defecto) o una web a medida hecha con la IA del dueño (MCP). */}
          {mode === "edit" && store?.id && (
            <div role="tablist" aria-label="Cómo quieres tu web" className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
              {([
                { id: "temas", label: "Tema de Vendfy", icon: Palette },
                { id: "ia", label: "Tu web con IA (MCP)", icon: Sparkles },
              ] as const).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={seccionDiseno === s.id}
                  onClick={() => setSeccionDiseno(s.id)}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    seccionDiseno === s.id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <s.icon className="h-4 w-4" />
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {seccionDiseno === "ia" && mode === "edit" && store?.id ? (
            <WebConTuIa
              nombreTienda={formData.name}
              url={formData.config?.storefront?.url}
              onUrlChange={(url) =>
                handleConfigFieldChange("storefront", { ...formData.config?.storefront, url })
              }
            />
          ) : (
            <>
          <DisenoTienda
            slug={formData.slug}
            storeId={mode === "edit" ? store?.id : undefined}
            nombre={formData.name}
            rubro={formData.config?.category}
            themeId={formData.config?.themeId}
            apariencia={formData.config?.apariencia}
            categorias={categoriasTienda}
            onCambiarTema={(themeId) => handleConfigFieldChange("themeId", themeId)}
            onCambiarApariencia={(apariencia) => handleConfigFieldChange("apariencia", apariencia)}
            onCambiarTitulo={(titulo) => handleConfigChange("branding", "heroTitle", titulo)}
            onCambiarNosotros={(texto) => handleConfigFieldChange("aboutUs", texto)}
            subirImagen={subirImagenDeTienda}
          />
            </>
          )}
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding" className="space-y-6">
          <Card className="p-6 space-y-6">
            <h3 className="text-lg font-semibold">Identidad Visual</h3>
            
            {/* Banner Interactivo */}
            <div>
              <Label className="text-base font-semibold mb-3 block">Banner de Fondo</Label>
              <p className="text-xs text-muted-foreground mb-3">Click para cambiar el banner (JPG o WEBP 1920x600px)</p>
              <div 
                className="relative w-full h-64 bg-muted rounded-lg overflow-hidden border-2 border-dashed border-border hover:border-primary transition-colors cursor-pointer group"
                onClick={() => bannerInputRef.current?.click()}
              >
                {/* Banner como fondo */}
                {formData.config?.branding?.bannerUrl ? (
                  <img
                    src={formData.config.branding.bannerUrl}
                    alt="Banner"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Upload className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p className="text-sm opacity-50">Click para subir banner</p>
                    </div>
                  </div>
                )}
                
                {/* Overlay oscuro para mejor contraste */}
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />
                
                {/* Indicador de hover */}
                {formData.config?.branding?.bannerUrl && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg">
                      <Upload className="h-5 w-5 inline mr-2" />
                      {uploadingBanner ? "Subiendo..." : "Cambiar Banner"}
                    </div>
                  </div>
                )}

                {/* Botón para eliminar banner */}
                {formData.config?.branding?.bannerUrl && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-4 right-4 h-8 w-8 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveBanner();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}

                {/* Título Hero si existe */}
                {formData.config?.branding?.heroTitle && (
                  <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none">
                    <h2 className="text-2xl font-bold text-white drop-shadow-lg">
                      {formData.config.branding.heroTitle}
                    </h2>
                  </div>
                )}
                
                {/* Logo en esquina inferior izquierda */}
                <div 
                  className="absolute bottom-6 left-6 cursor-pointer group/logo"
                  onClick={(e) => {
                    e.stopPropagation();
                    logoInputRef.current?.click();
                  }}
                >
                  {formData.config?.branding?.logoUrl ? (
                    <div className="relative">
                      <div className="bg-white/95 dark:bg-gray-900/95 p-3 rounded-lg shadow-2xl group-hover/logo:shadow-primary/50 transition-shadow">
                        <img
                          src={formData.config.branding.logoUrl}
                          alt="Logo"
                          className="h-16 w-auto object-contain"
                        />
                      </div>
                      {/* Indicador de edición en el logo */}
                      <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity">
                        <Upload className="h-6 w-6 text-white" />
                      </div>
                      {/* Botón eliminar logo */}
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/logo:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveLogo();
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="bg-white/95 dark:bg-gray-900/95 p-4 rounded-lg shadow-2xl hover:shadow-primary/50 transition-shadow">
                      <div className="flex flex-col items-center gap-2">
                        <StoreIcon className="h-12 w-12 text-muted-foreground opacity-30" />
                        <p className="text-xs text-muted-foreground">Click para subir logo</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Inputs ocultos */}
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                onChange={handleBannerUpload}
                className="hidden"
              />
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              
              <p className="text-xs text-muted-foreground mt-2">
                💡 Click en el fondo para cambiar el banner, click en el logo para cambiarlo
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 w-full">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Label htmlFor="heroTitle">Título Hero (aparece en el banner)</Label>
                  <AiFieldButton
                    field="store_heroTitle"
                    currentValues={storeAiContext}
                    onResult={(value) => { handleConfigChange("branding", "heroTitle", value); }}
                    skipNameCheck
                  />
                </div>
                <Input
                  id="heroTitle"
                  value={formData.config?.branding?.heroTitle || ""}
                  onChange={(e) => handleConfigChange("branding", "heroTitle", e.target.value)}
                  placeholder="Bienvenido a nuestra tienda"
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Contact Tab - Combined with Social */}
        <TabsContent value="contact" className="space-y-6">
          <Card className="p-6 space-y-4">
            <h3 className="text-lg font-semibold">Información de Contacto</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Teléfono</Label>
                <div className="flex gap-2">
                  <Select
                    value={phoneCountryCode}
                    onValueChange={handlePhoneCountryCodeChange}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {countryCodes.map((code) => (
                        <SelectItem key={code.value} value={code.value}>
                          {code.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="phone"
                    value={phoneNumber}
                    onChange={(e) => handlePhoneNumberChange(e.target.value)}
                    placeholder="71890091"
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.config?.contact?.email || ""}
                  onChange={(e) => handleConfigChange("contact", "email", e.target.value)}
                  placeholder="contacto@tienda.com"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="city">Ciudad</Label>
              <Input
                id="city"
                value={formData.config?.contact?.city || ""}
                onChange={(e) => handleConfigChange("contact", "city", e.target.value)}
                placeholder="La Paz"
              />
            </div>

            <div className="space-y-2">
              <Label>Ubicación de la Tienda</Label>
              <p className="text-sm text-muted-foreground">Busca o selecciona en el mapa la ubicación de tu tienda</p>
              <LocationPicker
                address={formData.config?.contact?.address || ""}
                coordinates={{
                  lat: formData.config?.contact?.coordinates?.latitude || 0,
                  lng: formData.config?.contact?.coordinates?.longitude || 0
                }}
                onAddressChange={(address) => handleConfigChange("contact", "address", address)}
                onLocationChange={(location) => handleConfigChange("contact", "coordinates", {
                  latitude: location.lat,
                  longitude: location.lng
                })}
                theme="classic"
              />
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-lg font-semibold">Redes Sociales</h3>
            
            <div>
              <Label htmlFor="facebook">Facebook URL</Label>
              <Input
                id="facebook"
                value={formData.config?.socialMedia?.facebookUrl || ""}
                onChange={(e) => handleConfigChange("socialMedia", "facebookUrl", e.target.value)}
                placeholder="https://facebook.com/tutienda"
              />
            </div>

            <div>
              <Label htmlFor="instagram">Instagram URL</Label>
              <Input
                id="instagram"
                value={formData.config?.socialMedia?.instagramUrl || ""}
                onChange={(e) => handleConfigChange("socialMedia", "instagramUrl", e.target.value)}
                placeholder="https://instagram.com/tutienda"
              />
            </div>
          </Card>
        </TabsContent>

        {/* Reviews Tab */}
        {mode === "edit" && store?.id && (
          <TabsContent value="reviews" className="space-y-6">
            <Card className="p-6">
              <StoreReviewsManager storeId={store.id} />
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
