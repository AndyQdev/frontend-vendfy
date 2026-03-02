import { useState, useEffect, useRef } from "react";
import { Save, Store as StoreIcon, Eye, Palette, Phone, Star, Globe, Settings, Plus, X, CheckCircle, Upload, Trash2, Monitor, Tablet, Smartphone } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Card } from "@/shared/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { useUpdateStore } from "@/entities/store/api";
import { apiFetch } from "@/shared/api/client";
import type { Store, StoreConfig } from "@/entities/store/model/types";
import { toast } from "sonner";
import { LocationPicker } from "@/shared/ui/LocationPicker";

interface StoreConfigFormProps {
  store: Store;
  onUpdate: () => void;
}

export function StoreConfigForm({ store, onUpdate }: StoreConfigFormProps) {
  const [formData, setFormData] = useState<Store>(store);
  const [isEditing, setIsEditing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Estados para el teléfono con código de país
  const [phoneCountryCode, setPhoneCountryCode] = useState("591");
  const [phoneNumber, setPhoneNumber] = useState("");

  const updateStore = useUpdateStore();

  useEffect(() => {
    setFormData(store);
    
    // Extraer código de país y número del teléfono almacenado
    const storedPhone = store.config?.contact?.phone || "";
    if (storedPhone.includes("-")) {
      const [code, number] = storedPhone.split("-");
      setPhoneCountryCode(code);
      setPhoneNumber(number);
    } else {
      setPhoneNumber(storedPhone);
    }
  }, [store]);

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

  const handleSave = async () => {
    try {
      await updateStore.mutateAsync({ id: store.id, data: formData });
      setIsEditing(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      onUpdate();
      toast.success("Tienda actualizada correctamente");
    } catch (error) {
      console.error("Error updating store:", error);
      toast.error("Error al actualizar la tienda");
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

  const categories = [
    { value: "tecnologia", label: "Tecnología" },
    { value: "moda", label: "Moda" },
    { value: "hogar", label: "Hogar" },
    { value: "abarrotes", label: "Abarrotes" },
    { value: "belleza", label: "Belleza" },
    { value: "deportes", label: "Deportes" },
    { value: "arte", label: "Arte" }
  ];

  // Temas disponibles por categoría
  const themesByCategory: Record<string, Array<{ value: string; label: string }>> = {
    tecnologia: [
      { value: "modern", label: "Modern - Estilo tecnológico moderno" }
    ],
    moda: [
      { value: "elegante", label: "Elegante - Estilo fashion sofisticado" }
    ],
    hogar: [
      { value: "minimal", label: "Minimal - Estilo minimalista limpio" }
    ],
    abarrotes: [
      { value: "minimal", label: "Minimal - Estilo minimalista limpio" }
    ],
    belleza: [
      { value: "classic", label: "Classic - Estilo clásico elegante" }
    ],
    deportes: [
      { value: "darkmode", label: "Dark Mode - Estilo oscuro deportivo" }
    ],
    arte: [
      { value: "creative", label: "Creative - Estilo creativo artístico" }
    ]
  };

  // Obtener temas disponibles según la categoría seleccionada
  const availableThemes = formData.config?.category 
    ? themesByCategory[formData.config.category] || []
    : [];

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Configuración de Tienda</h1>
          <p className="text-muted-foreground mt-1">Personaliza todos los aspectos de tu tienda online</p>
        </div>
        <div className="flex items-center gap-3">
          {showSuccess && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Guardado exitosamente</span>
            </div>
          )}
          {/* <Button variant="outline">
            <Eye className="h-4 w-4 mr-2" />
            Vista Previa
          </Button> */}
          <Button onClick={handleSave} disabled={!isEditing || updateStore.isPending}>
            {updateStore.isPending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {updateStore.isPending ? "Guardando..." : "Guardar Cambios"}
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

      {/* Tabs */}
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
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
                onChange={(e) => handleInputChange("name", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) => handleInputChange("description", e.target.value)}
                rows={4}
                placeholder="Describe tu tienda..."
              />
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
              <Label htmlFor="aboutUs">Sobre Nosotros</Label>
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
          <Card className="p-6 space-y-4">
            <h3 className="text-lg font-semibold">Diseño y Temas</h3>
            <p className="text-sm text-muted-foreground">
              Personaliza la apariencia visual de tu tienda
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Categoría</Label>
                <Select
                  value={formData.config?.category || ""}
                  onValueChange={(value) => {
                    handleConfigFieldChange("category", value);
                    // Limpiar themeId si cambia la categoría para que seleccione el tema correspondiente
                    const newTheme = themesByCategory[value]?.[0]?.value || "minimal";
                    handleConfigFieldChange("themeId", newTheme);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  La categoría determina el tema visual disponible
                </p>
              </div>

              <div>
                <Label htmlFor="themeId">Tema de Diseño</Label>
                <Select
                  value={formData.config?.themeId || ""}
                  onValueChange={(value) => handleConfigFieldChange("themeId", value)}
                  disabled={!formData.config?.category}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.config?.category ? "Seleccionar tema" : "Primero selecciona una categoría"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableThemes.map((theme) => (
                      <SelectItem key={theme.value} value={theme.value}>
                        {theme.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.config?.themeId 
                    ? `Tema actual: ${availableThemes.find(t => t.value === formData.config?.themeId)?.label || formData.config.themeId}`
                    : "Selecciona primero una categoría"
                  }
                </p>
              </div>
            </div>
          </Card>

          {/* Vista Previa en Vivo del Tema */}
          {formData.config?.themeId && (
            <Card className="p-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Vista Previa del Tema</h3>
                    <p className="text-sm text-muted-foreground">
                      Preview en tiempo real de cómo se verá tu tienda
                    </p>
                  </div>
                  
                  {/* Botones de selección de dispositivo */}
                  <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                    <Button
                      variant={previewDevice === 'desktop' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setPreviewDevice('desktop')}
                      className="h-8 px-3"
                    >
                      <Monitor className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Desktop</span>
                    </Button>
                    <Button
                      variant={previewDevice === 'tablet' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setPreviewDevice('tablet')}
                      className="h-8 px-3"
                    >
                      <Tablet className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Tablet</span>
                    </Button>
                    <Button
                      variant={previewDevice === 'mobile' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setPreviewDevice('mobile')}
                      className="h-8 px-3"
                    >
                      <Smartphone className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Móvil</span>
                    </Button>
                  </div>
                </div>
                
                <div className="relative w-full bg-muted/10 rounded-lg overflow-hidden border-2 border-border flex justify-center py-4">
                  {/* Iframe con la tienda en vivo - tamaño responsive */}
                  <div 
                    className="transition-all duration-300 ease-in-out"
                    style={{
                      width: previewDevice === 'desktop' ? '100%' : previewDevice === 'tablet' ? '768px' : '375px',
                      maxWidth: '100%'
                    }}
                  >
                    <iframe
                      key={`theme-preview-${formData.config.themeId}-${previewDevice}`}
                      src={`http://localhost:3000/${formData.slug}?theme=${formData.config.themeId}&preview=true`}
                      className="w-full h-[600px] border-0 rounded-lg shadow-lg"
                      title="Vista previa del tema"
                      loading="lazy"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    💡 El preview se actualiza automáticamente al cambiar el tema
                  </p>
                  <p className="text-xs text-muted-foreground font-medium">
                    {previewDevice === 'desktop' && '🖥️ Vista Desktop (100%)'}
                    {previewDevice === 'tablet' && '📱 Vista Tablet (768px)'}
                    {previewDevice === 'mobile' && '📱 Vista Móvil (375px)'}
                  </p>
                </div>
              </div>
            </Card>
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
                className="relative w-full h-64 bg-gradient-to-br from-muted/50 to-muted rounded-lg overflow-hidden border-2 border-dashed border-border hover:border-primary transition-colors cursor-pointer group"
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
                    className="absolute top-4 right-4 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
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
                        className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover/logo:opacity-100 transition-opacity"
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
                <Label htmlFor="heroTitle">Título Hero (aparece en el banner)</Label>
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
      </Tabs>
    </div>
  );
}
