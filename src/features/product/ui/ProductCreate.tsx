import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Save, Image as ImageIcon, Plus, X, Tag, Info, ScanBarcode, Sparkles, Loader2 } from "lucide-react";
import { ApiError } from "@/shared/api/client";
import { AiFieldButton } from "@/shared/ui/ai-field-button";
import { AiModelPicker } from "@/shared/ui/ai-model-picker";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Card } from "@/shared/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import { ImageUploadModal } from "@/shared/ui/image-upload-modal";
import { CreateBrandModal } from "@/features/product/ui/CreateBrandModal";
import { CreateCategoryModal } from "@/features/product/ui/CreateCategoryModal";
import { ImportarEspecificacionesModal } from "@/features/product/ui/ImportarEspecificacionesModal";
import { ImportarEtiquetasModal } from "@/features/product/ui/ImportarEtiquetasModal";
import { BotonImportar } from "@/shared/ui/importar-modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { useUnitsOfMeasure } from "@/entities/inventory/api";
import { useStore } from "@/app/providers/auth";
import { useProduct, useCreateProduct, useUpdateProduct, useCategories, useBrands } from "@/entities/product/api";
import type { ProductInput } from "@/entities/product/model/schema";
import type { EnriquecimientoIa, ResultadoEscaneo, SugerenciaCatalogo } from "@/entities/product/model/escaneo";
import { sonar, useEnriquecimientoIa, useEscaner, useManejadorEscaneo } from "@/features/scanner";
import { StoreReviewsManager } from "@/features/store/ui/StoreReviewsManager";
import { useRegreso } from "@/shared/hooks/use-regreso";
import { toast } from "sonner";

export default function CreateProduct() {
  const { id: productId } = useParams();
  // El asistente manda acá lo que no encontró en el catálogo ("coca 2
  // litros"): hacérselo escribir otra vez sería pedirle lo mismo dos veces.
  const [params] = useSearchParams();
  // El escáner manda acá lo que ya sabe de un código ("Completar más datos"):
  // nombre, marca, foto y contenido del catálogo, más el precio si lo puso.
  const estadoNavegacion = useLocation().state as { prefill?: Partial<ProductInput> } | null;
  const prefill = productId ? undefined : estadoNavegacion?.prefill;
  const { selectedStore } = useStore();
  const isEditMode = Boolean(productId);
  // Vuelve a la lista tal como estaba -con su búsqueda y sus filtros- y no al
  // catálogo entero.
  const volverALista = useRegreso("/products");
  // Marca que vino del catálogo y el comercio todavía no tiene: se crea al guardar.
  const [marcaSugerida, setMarcaSugerida] = useState(prefill?.brandName ?? "");
  // Ídem la categoría que propuso la IA.
  const [categoriaSugerida, setCategoriaSugerida] = useState(prefill?.categoryName ?? "");

  // State for form data
  const [formData, setFormData] = useState<ProductInput>({
    name: prefill?.name ?? (productId ? "" : (params.get("nombre") ?? "")),
    description: prefill?.description ?? "",
    imageUrls: prefill?.imageUrls ?? [],
    sku: "",
    barcode: prefill?.barcode ?? "",
    categoryId: prefill?.categoryId ?? "",
    brandId: prefill?.brandId ?? "",
    storeId: typeof selectedStore === "object" ? selectedStore?.id || "" : "",
    price: prefill?.price ?? 0,
    initialStock: prefill?.initialStock ?? 0,
    metadata: {
      isFeatured: false,
      tags: prefill?.metadata?.tags ?? [],
      specifications: prefill?.metadata?.specifications ?? {}
    }
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // ─── Medida (opcional) ───────────────────────────────────────────────
  // Apagado por defecto: la enorme mayoría de los productos se venden por
  // unidades y no tienen por qué ver esto.
  const [porMedida, setPorMedida] = useState(false);
  // Precio de UNA unidad base: Bs por ml, por gramo. Es lo único que hace
  // falta para vender fraccionado; qué medidas se ofrecen (10, 20, 30 ml) lo
  // decide cada tienda en su web, no nosotros.
  const [precioPorMedida, setPrecioPorMedida] = useState<number>(0);
  const [unidadBase, setUnidadBase] = useState("ml");
  const [contenido, setContenido] = useState<number>(0);
  const { data: unidades = [] } = useUnitsOfMeasure(true);

  // Las unidades en que tiene sentido fraccionar: 'unidad' no sirve para esto.
  const unidadesMedibles = useMemo(
    () => unidades.filter((u) => u.code !== "unit"),
    [unidades]
  );
  const unidadElegida = unidadesMedibles.find((u) => u.code === unidadBase);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [specificationKey, setSpecificationKey] = useState("");
  const [specificationValue, setSpecificationValue] = useState("");
  const [importarSpecs, setImportarSpecs] = useState(false);
  const [importarTags, setImportarTags] = useState(false);

  // API calls
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const { data: categoriesData } = useCategories();
  const { data: brandsData } = useBrands();

  // Load existing product in edit mode
  const { data: existingProduct } = useProduct(productId);

  useEffect(() => {
    if (existingProduct && isEditMode) {
      const currentStoreId = typeof selectedStore === "object" ? selectedStore?.id || "" : "";

      // El precio vive en store_product y el stock en inventory (por tienda):
      // se toma el de la tienda seleccionada, o el primero si no hay match.
      const storeProducts: any[] = (existingProduct as any).storeProducts || [];
      const storeProduct =
        storeProducts.find((sp) => sp.store?.id === currentStoreId) || storeProducts[0];
      const inventories: any[] = (existingProduct as any).inventories || [];
      const inventory =
        inventories.find((inv) => inv.store?.id === currentStoreId) || inventories[0];

      const p: any = existingProduct;
      if (p.inventoryType === "fractional") {
        setPorMedida(true);
        setUnidadBase(p.baseUnit?.code || "ml");
        setContenido(p.contentPerUnit || 0);
        setPrecioPorMedida(Number(storeProduct?.pricePerBaseUnit) || 0);
      }

      setFormData({
        name: existingProduct.name || "",
        description: existingProduct.description || "",
        imageUrls: existingProduct.imageUrls || [],
        sku: existingProduct.sku || "",
        barcode: codigoLegible(existingProduct.barcode),
        categoryId: existingProduct.category?.id || "",
        brandId: existingProduct.brand?.id || "",
        storeId: storeProduct?.store?.id || currentStoreId,
        price: storeProduct ? Number(storeProduct.price) || 0 : 0,
        initialStock: inventory?.stockQuantity ?? 0,
        metadata: {
          isFeatured: existingProduct.metadata?.isFeatured || false,
          tags: existingProduct.metadata?.tags || [],
          specifications: existingProduct.metadata?.specifications || {}
        }
      });
    }
  }, [existingProduct, isEditMode, selectedStore]);

  // Sincronizar storeId cuando cambie la tienda seleccionada
  useEffect(() => {
    if (!isEditMode && selectedStore && typeof selectedStore === "object" && selectedStore.id) {
      setFormData(prev => ({ ...prev, storeId: selectedStore.id }));
    }
  }, [selectedStore, isEditMode]);

  const categories = categoriesData || [];
  const brands = brandsData || [];

  // Si la marca sugerida ya existe en el comercio, se elige esa en vez de crear otra.
  useEffect(() => {
    if (!marcaSugerida || formData.brandId) return;
    const existente = brands.find((b) => b.name.trim().toLowerCase() === marcaSugerida.trim().toLowerCase());
    if (existente) {
      setFormData((prev) => ({ ...prev, brandId: existente.id }));
      setMarcaSugerida("");
    }
  }, [brands, marcaSugerida, formData.brandId]);

  // Ídem la categoría: si ya hay una igual o parecida ("Bebidas" y "bebidas
  // gaseosas"), se elige esa en vez de crear otra.
  useEffect(() => {
    if (!categoriaSugerida || formData.categoryId) return;
    const buscada = normalizar(categoriaSugerida);
    // Con subcategorías la sugerencia puede venir con ruta ("Accesorios ›
    // Cargadores"): primero la ruta exacta, después el nombre suelto.
    const existente =
      categories.find((c) => c.fullName && normalizar(c.fullName) === buscada) ??
      categories.find((c) => {
        const nombre = normalizar(c.name);
        return nombre === buscada || nombre.includes(buscada) || buscada.includes(nombre);
      });
    if (existente) {
      setFormData((prev) => ({ ...prev, categoryId: existente.id }));
      setCategoriaSugerida("");
    }
  }, [categories, categoriaSugerida, formData.categoryId]);

  // ─── Escáner ──────────────────────────────────────────────────────────
  // Al crear, el código llena el formulario con lo que sabe el catálogo
  // (nombre, marca, categoría, foto con IA, ficha) y deja el cursor en el
  // precio, que es lo único que no se puede saber. Al editar, le asigna el
  // código. Si el código ya es de otro producto, se avisa en vez de duplicarlo.
  const navigate = useNavigate();
  const { buscar } = useEscaner();
  const [codigoAjeno, setCodigoAjeno] = useState<{ id: string; nombre: string } | null>(null);
  const [delCatalogo, setDelCatalogo] = useState<ResultadoEscaneo | null>(null);
  // Lo que puso el último escaneo: otro escaneo lo reemplaza, pero lo que
  // escribió la persona no se pisa.
  const rellenado = useRef<Partial<Record<CampoCatalogo, unknown>>>({});
  const formRef = useRef(formData);
  formRef.current = formData;

  /**
   * Pone lo del catálogo (o nada, si el código es nuevo) en los campos que
   * están vacíos o que llenó el escaneo anterior; lo escrito a mano queda.
   */
  const llenarDesdeCatalogo = (s: SugerenciaCatalogo | null, ia?: EnriquecimientoIa) => {
    const ficha = ia?.ficha ?? s?.ia?.ficha ?? null;
    const foto = ia?.imagenUrl ?? s?.ia?.imagenUrl ?? s?.imagenUrl;
    const nuevo: Record<CampoCatalogo, unknown> = {
      name: !s ? "" : ficha?.nombre ?? (s.cantidad && !s.nombre.includes(s.cantidad) ? `${s.nombre} ${s.cantidad}` : s.nombre),
      description: ficha?.descripcion ?? "",
      imageUrls: foto ? [foto] : [],
      tags: ficha?.etiquetas ?? [],
      specifications:
        ficha && Object.keys(ficha.especificaciones).length
          ? ficha.especificaciones
          : s?.cantidad
            ? { Contenido: s.cantidad }
            : {},
    };
    const antes = rellenado.current;
    const cabe = (actual: unknown, campo: CampoCatalogo) => vacio(actual) || igual(actual, antes[campo]);
    setFormData((prev) => ({
      ...prev,
      name: cabe(prev.name, "name") ? (nuevo.name as string) : prev.name,
      description: cabe(prev.description, "description") ? (nuevo.description as string) : prev.description,
      imageUrls: cabe(prev.imageUrls, "imageUrls") ? (nuevo.imageUrls as string[]) : prev.imageUrls,
      metadata: {
        ...prev.metadata,
        tags: cabe(prev.metadata?.tags, "tags") ? (nuevo.tags as string[]) : prev.metadata?.tags,
        specifications: cabe(prev.metadata?.specifications, "specifications")
          ? (nuevo.specifications as Record<string, string>)
          : prev.metadata?.specifications,
      },
    }));
    rellenado.current = nuevo;
    const marca = ficha?.marca ?? s?.marca;
    if (marca && !formRef.current.brandId) setMarcaSugerida(marca);
    if (ficha?.categoria && !formRef.current.categoryId) setCategoriaSugerida(ficha.categoria);
  };

  useManejadorEscaneo(
    async (lectura) => {
      const r = await buscar(lectura.codigo);
      const codigo = r.codigoLegible || lectura.codigo;

      // Ya es de otro producto: se avisa (el servidor tampoco lo aceptaría).
      if (r.producto && r.producto.id !== productId) {
        sonar("error");
        setCodigoAjeno({ id: r.producto.id, nombre: r.producto.name });
        return true;
      }
      setCodigoAjeno(null);

      if (isEditMode) {
        const anterior = (formRef.current.barcode ?? "").trim();
        setFormData((prev) => ({ ...prev, barcode: codigo }));
        sonar("encontrado");
        if (r.producto) {
          toast.success("Es este producto", { description: "Ese código ya es suyo." });
        } else {
          const reemplaza = anterior && anterior !== codigo;
          toast.success(reemplaza ? "Código reemplazado" : "Código cargado", {
            description: "Tocá Actualizar para guardarlo.",
            ...(reemplaza
              ? { action: { label: "Deshacer", onClick: () => setFormData((prev) => ({ ...prev, barcode: anterior })) } }
              : {}),
          });
        }
        return true;
      }

      setFormData((prev) => ({ ...prev, barcode: codigo }));
      if (r.sugerencia) {
        sonar("sugerido");
        setDelCatalogo(r);
        llenarDesdeCatalogo(r.sugerencia);
        toast.success("Lo completamos con el catálogo", { description: "Revisá los datos y poné el precio." });
        enfocar("price");
      } else {
        sonar("nuevo");
        // Lo que había puesto un escaneo anterior era de OTRO producto.
        if (delCatalogo) {
          llenarDesdeCatalogo(null);
          setMarcaSugerida("");
          setCategoriaSugerida("");
        }
        setDelCatalogo(null);
        toast.info("Código nuevo", { description: "Nadie lo cargó todavía: completá el nombre y el precio." });
        enfocar("name");
      }
      return true;
    },
    true,
    isEditMode ? "Le asigna el código a este producto" : "Completa el formulario con el catálogo",
  );

  // Context for AI buttons - always up to date with form state
  const aiContext = useMemo(() => ({
    name: formData.name,
    description: formData.description,
    tags: formData.metadata?.tags,
    specifications: formData.metadata?.specifications,
    categoryName: categories.find(c => c.id === formData.categoryId)?.name,
    brandName: brands.find(b => b.id === formData.brandId)?.name,
  }), [formData, categories, brands]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleAddTag = () => {
    const input = tagInput.trim();
    if (!input) return;

    // Detectar si hay múltiples hashtags
    if (input.includes('#')) {
      // Extraer todos los hashtags
      const hashtags = input
        .split(/[\s\n]+/) // Dividir por espacios o saltos de línea
        .map(tag => tag.replace(/^#+/, '').trim()) // Quitar # del inicio
        .filter(tag => tag.length > 0); // Filtrar vacíos

      // Agregar solo los hashtags que no existan ya
      const existingTags = formData.metadata?.tags || [];
      const newTags = hashtags.filter(tag => !existingTags.includes(tag));

      if (newTags.length > 0) {
        setFormData(prev => ({
          ...prev,
          metadata: {
            ...prev.metadata,
            tags: [...(prev.metadata?.tags || []), ...newTags]
          }
        }));
      }
      setTagInput("");
    } else {
      // Comportamiento normal para etiquetas sin hashtag
      if (!formData.metadata?.tags?.includes(input)) {
        setFormData(prev => ({
          ...prev,
          metadata: {
            ...prev.metadata,
            tags: [...(prev.metadata?.tags || []), input]
          }
        }));
        setTagInput("");
      }
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        tags: prev.metadata?.tags?.filter(t => t !== tag) || []
      }
    }));
  };

  const handleAddSpecification = () => {
    if (specificationKey.trim() && specificationValue.trim()) {
      setFormData(prev => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          specifications: {
            ...(prev.metadata?.specifications || {}),
            [specificationKey.trim()]: specificationValue.trim()
          }
        }
      }));
      setSpecificationKey("");
      setSpecificationValue("");
    }
  };

  /**
   * Suma lo importado a lo que ya estaba: una clave repetida se pisa y el
   * resto se conserva, así se pueden pegar dos listas seguidas -los acordes y
   * después la ficha técnica- sin perder la primera.
   */
  const handleImportSpecifications = (importadas: Record<string, string>) => {
    setFormData(prev => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        specifications: {
          ...(prev.metadata?.specifications || {}),
          ...importadas
        }
      }
    }));
    const cuantas = Object.keys(importadas).length;
    toast.success(
      cuantas === 1
        ? "Se importó 1 especificación"
        : `Se importaron ${cuantas} especificaciones`
    );
  };

  /** Suma las etiquetas pegadas a las que ya estaban, sin repetir. */
  const handleImportTags = (etiquetas: string[]) => {
    setFormData(prev => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        tags: [...(prev.metadata?.tags || []), ...etiquetas]
      }
    }));
    toast.success(
      etiquetas.length === 1
        ? "Se importó 1 etiqueta"
        : `Se importaron ${etiquetas.length} etiquetas`
    );
  };

  const handleRemoveSpecification = (key: string) => {
    setFormData(prev => {
      const newSpecs = { ...(prev.metadata?.specifications || {}) };
      delete newSpecs[key];
      return {
        ...prev,
        metadata: {
          ...prev.metadata,
          specifications: newSpecs
        }
      };
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "El nombre del producto es requerido";
    }

    if (!formData.price || formData.price <= 0) {
      newErrors.price = "El precio debe ser mayor a 0";
    }

    // Validar que haya una tienda seleccionada válida
    if (!formData.storeId || selectedStore === "all" || selectedStore === null) {
      newErrors.storeId = "Debes seleccionar una tienda específica";
      toast.error("Por favor selecciona una tienda antes de crear el producto");
    }

    if (porMedida && (!contenido || contenido <= 0)) {
      newErrors.contenido = "Indica cuánto trae cada envase (por ejemplo, 100).";
    }

    if (porMedida && (!precioPorMedida || precioPorMedida <= 0)) {
      newErrors.precioPorMedida =
        "Indica cuánto cobras por unidad de medida, o apaga la venta por medida.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitting form with data:", formData);
    if (!validateForm()) {
      return;
    }
    console.log("Form data is valid, proceeding to save.");
    try {
      // Clean empty strings so backend doesn't validate them as UUIDs
      const payload = {
        ...formData,
        brandId: formData.brandId || undefined,
        categoryId: formData.categoryId || undefined,
        sku: formData.sku || undefined,
        // Al editar, vacío significa "sacale el código"; al crear, simplemente no se manda.
        barcode: isEditMode ? (formData.barcode ?? "").trim() : formData.barcode?.trim() || undefined,
        brandName: !formData.brandId && marcaSugerida ? marcaSugerida : undefined,
        categoryName: !formData.categoryId && categoriaSugerida ? categoriaSugerida : undefined,
        // En edición el stock se gestiona desde Inventario/Compras
        initialStock: isEditMode ? undefined : formData.initialStock,
        // La medida SOLO viaja si el usuario la activó. Un producto normal no
        // manda estos campos y el backend lo trata como unitario, igual que
        // siempre.
        ...(porMedida
          ? {
              inventoryType: "fractional" as const,
              baseUnitCode: unidadBase,
              contentPerUnit: contenido,
              // Sin esto el producto se puede fraccionar pero no vender
              // fraccionado: la tienda no sabría cuánto cobrar.
              pricePerBaseUnit: precioPorMedida > 0 ? precioPorMedida : undefined,
              // El stock inicial se escribe en envases y se guarda en unidad
              // base: 3 frascos de 100 ml son 300 ml. Al editar no se toca:
              // el stock se maneja desde Inventario.
              ...(isEditMode
                ? {}
                : { initialStock: (formData.initialStock || 0) * contenido }),
            }
          : {}),
      };

      if (isEditMode && productId) {
        await updateProduct.mutateAsync({ id: productId, data: payload });
        toast.success("Producto actualizado correctamente");
      } else {
        await createProduct.mutateAsync(payload);
        toast.success("Producto creado correctamente");
      }
      volverALista();
    } catch (error) {
      console.error("Error saving product:", error);
      // El backend explica lo que importa (p. ej. "Ese código de barras ya es de «X»").
      toast.error(isEditMode ? "Error al actualizar el producto" : "Error al crear el producto", {
        description: error instanceof ApiError ? error.message : undefined,
      });
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={volverALista} aria-label="Volver a productos">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="titulo-pagina">
              {isEditMode ? "Editar Producto" : "Crear Nuevo Producto"}
            </h1>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {isEditMode
                ? "Modifica la información del producto"
                : "Completa la información del nuevo producto"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Con qué IA responden los botones "IA" repartidos por el formulario.
              Uno solo arriba: repetirlo junto a cada campo sería ruido. */}
          <AiModelPicker />
          <Button onClick={handleSubmit} disabled={createProduct.isPending || updateProduct.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {createProduct.isPending || updateProduct.isPending
              ? "Guardando..."
              : isEditMode
              ? "Actualizar"
              : "Crear Producto"}
          </Button>
        </div>
      </div>

      {codigoAjeno && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground"
        >
          <ScanBarcode className="h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            {isEditMode ? "Ese código ya es de " : "Ya tenés "}
            <span className="font-semibold">«{codigoAjeno.nombre}»</span>
            {isEditMode ? ": un código no puede ser de dos productos." : " con este código: no hace falta crearlo de nuevo."}
          </span>
          <Button type="button" size="sm" variant="outline" onClick={() => navigate(`/products/${codigoAjeno.id}`)}>
            Abrir «{codigoAjeno.nombre}»
          </Button>
          <button
            type="button"
            onClick={() => setCodigoAjeno(null)}
            aria-label="Cerrar el aviso"
            className="rounded p-1 hover:bg-warning/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Información Básica</h2>
            
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Label htmlFor="name">
                  Nombre del Producto <span className="text-red-500">*</span>
                </Label>
                <HintIcon>
                  Es como tus clientes verán el producto en tu tienda online y en caja. Sé claro y específico (ej: "Camisa blanca algodón M").
                </HintIcon>
              </div>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={errors.name ? "border-red-500" : ""}
                placeholder="Ej: iPhone 15 Pro Max"
              />
              {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Label htmlFor="barcode">Código de barras</Label>
                  <HintIcon>
                    El que viene impreso en el envase. Hacé clic acá y escanealo con la pistola. Con esto, al escanear el producto en cualquier pantalla aparece solo, y en Caja va directo a la venta.
                  </HintIcon>
                </div>
                <div className="relative">
                  <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    id="barcode"
                    name="barcode"
                    // La pistola escribe acá en vez de abrir la ficha del producto.
                    data-scanner="input"
                    value={formData.barcode ?? ""}
                    onChange={handleInputChange}
                    placeholder="Escaneá o escribí el código"
                    className="pl-9 font-mono"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Label htmlFor="sku">SKU (Opcional)</Label>
                  <HintIcon>
                    Tu código interno del producto. Si no tiene código de barras, puedes inventarlo (ej: CAMI-001). Te servirá para encontrarlo rápido en caja.
                  </HintIcon>
                </div>
                <Input
                  id="sku"
                  name="sku"
                  value={formData.sku}
                  onChange={handleInputChange}
                  placeholder="Ej: IPH15PM-256-BLK"
                />
              </div>
            </div>

            {delCatalogo?.sugerencia && !isEditMode && (
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                  Completado con el catálogo de productos. Revisalo y poné el precio.
                </p>
                {delCatalogo.sugerencia.ia?.estado === "generando" && (
                  <SeguirIa
                    key={delCatalogo.codigo}
                    resultado={delCatalogo}
                    onListo={(ia) => llenarDesdeCatalogo(delCatalogo.sugerencia!, ia)}
                  />
                )}
              </div>
            )}

            {categoriaSugerida && !formData.categoryId && (
              <p className="flex items-center gap-1.5 rounded-lg bg-primary-soft px-3 py-2 text-sm text-primary-soft-foreground">
                <Tag className="h-4 w-4 shrink-0" aria-hidden />
                Categoría sugerida: <span className="font-semibold">{categoriaSugerida}</span> — se crea al guardar.
                <button
                  type="button"
                  className="ml-auto text-xs underline underline-offset-2"
                  onClick={() => setCategoriaSugerida("")}
                >
                  No usar
                </button>
              </p>
            )}

            {marcaSugerida && !formData.brandId && (
              <p className="flex items-center gap-1.5 rounded-lg bg-primary-soft px-3 py-2 text-sm text-primary-soft-foreground">
                <Tag className="h-4 w-4 shrink-0" aria-hidden />
                Marca del catálogo: <span className="font-semibold">{marcaSugerida}</span> — se crea al guardar.
                <button
                  type="button"
                  className="ml-auto text-xs underline underline-offset-2"
                  onClick={() => setMarcaSugerida("")}
                >
                  No usar
                </button>
              </p>
            )}

            <div>
              <div className="flex items-center gap-2 mb-1">
                <Label htmlFor="description">Descripción</Label>
                <HintIcon>
                  Cuéntale al cliente qué hace especial a tu producto: materiales, tallas, beneficios. Aparece en la ficha del producto en tu tienda online. Pulsa <span className="font-medium">IA</span> para que te ayudemos.
                </HintIcon>
                <AiFieldButton
                  storeId={formData.storeId}
                  field="description"
                  currentValues={aiContext}
                  onResult={(value) => setFormData(prev => ({ ...prev, description: value }))}
                />
              </div>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={5}
                className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder="Describe el producto en detalle..."
              />
            </div>
          </Card>

          {/* Images */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Imágenes del Producto</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsImageModalOpen(true)}
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                {formData.imageUrls && formData.imageUrls.length > 0
                  ? `Gestionar (${formData.imageUrls.length})`
                  : "Agregar Imágenes"}
              </Button>
            </div>

            {formData.imageUrls && formData.imageUrls.length > 0 ? (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                {formData.imageUrls.map((url, index) => (
                  <div key={index} className="relative aspect-square group">
                    <img
                      src={url}
                      alt={`Product ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg border"
                    />
                    <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded-full">
                      {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay imágenes cargadas</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Haz clic en el botón para agregar imágenes
                </p>
              </div>
            )}
          </Card>

          {/* Specifications */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Especificaciones</h2>
              <HintIcon>
                Datos técnicos del producto en formato clave-valor (ej: "Talla: M", "Material: 100% algodón"). Aparecen como tabla en la ficha del producto y ayudan al cliente a decidir.
              </HintIcon>
              <AiFieldButton
                storeId={formData.storeId}
                field="specifications"
                currentValues={aiContext}
                onResult={(value) => setFormData(prev => ({
                  ...prev,
                  metadata: {
                    ...prev.metadata,
                    specifications: { ...(prev.metadata?.specifications || {}), ...value }
                  }
                }))}
              />
              {/* Cargar diez acordes de a uno son veinte pulsaciones; pegarlos
                  es una sola. */}
              <BotonImportar
                onClick={() => setImportarSpecs(true)}
                title="Pegar una lista y llenar las especificaciones de golpe"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Input
                value={specificationKey}
                onChange={(e) => setSpecificationKey(e.target.value)}
                placeholder="Nombre (Ej: Pantalla)"
              />
              <div className="flex gap-2">
                <Input
                  value={specificationValue}
                  onChange={(e) => setSpecificationValue(e.target.value)}
                  placeholder="Valor (Ej: 6.1 pulgadas)"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSpecification())}
                />
                <Button
                  type="button"
                  onClick={handleAddSpecification}
                  disabled={!specificationKey.trim() || !specificationValue.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {formData.metadata?.specifications &&
              Object.keys(formData.metadata.specifications).length > 0 && (
                <div className="space-y-2">
                  {Object.entries(formData.metadata.specifications).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-sm text-emerald-900 dark:text-emerald-100">{key}</p>
                        <p className="text-sm text-emerald-700 dark:text-emerald-300">{value}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveSpecification(key)}
                        className="hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
          </Card>
        </div>

        {/* Sidebar - 1/3 */}
        <div className="space-y-6">
          {/* Category & Brand */}
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Organización</h2>
            
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Label htmlFor="category">Categoría</Label>
                <HintIcon>
                  Agrupa productos del mismo tipo (ej: "Camisas", "Pantalones"). Tus clientes pueden filtrar por categoría en tu tienda online. Crea una nueva con el botón +.
                </HintIcon>
              </div>
              <div className="flex gap-2">
                <Select
                  value={formData.categoryId}
                  onValueChange={(value) => handleSelectChange("categoryId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.fullName || category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIsCategoryModalOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <Label htmlFor="brand">Marca</Label>
                <HintIcon>
                  Es el fabricante o casa del producto (ej: "Apple", "Adidas"). Útil para diferenciar productos similares. Opcional.
                </HintIcon>
              </div>
              <div className="flex gap-2">
                <Select
                  value={formData.brandId}
                  onValueChange={(value) => handleSelectChange("brandId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar marca" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIsBrandModalOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <Label htmlFor="price">
                  Precio <span className="text-red-500">*</span>
                </Label>
                <HintIcon>
                  Es lo que cobras al cliente final. El costo (lo que pagas tú al proveedor) se registra aparte en Compras y se usa para calcular tu ganancia.
                </HintIcon>
              </div>
              <Input
                id="price"
                name="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                className={errors.price ? "border-red-500" : ""}
                placeholder="Ej: 999.99"
              />
              {errors.price && <p className="text-sm text-red-500 mt-1">{errors.price}</p>}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <Label htmlFor="initialStock">{isEditMode ? "Stock Actual" : "Stock Inicial"}</Label>
                <HintIcon>
                  Cuántas unidades tienes ahora mismo. Cuando vendas, el stock baja automáticamente. Cuando recargues, hazlo desde <span className="font-medium">Compras</span> para que quede registrado en tus reportes.
                </HintIcon>
              </div>
              <Input
                id="initialStock"
                name="initialStock"
                type="number"
                min="0"
                value={formData.initialStock}
                onChange={(e) => setFormData(prev => ({ ...prev, initialStock: parseInt(e.target.value) || 0 }))}
                placeholder="Ej: 10"
                disabled={isEditMode}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {isEditMode
                  ? "El stock se gestiona desde Inventario y Compras, no desde aquí."
                  : porMedida && contenido > 0 && unidadElegida
                    ? `Cuántos envases tienes. El sistema guardará ${
                        (formData.initialStock || 0) * contenido
                      } ${unidadElegida.symbol} en total.`
                    : "Lo que tienes hoy. Si no tienes stock todavía, déjalo en 0."}
              </p>
            </div>
          </Card>

          {/* ─── Se vende por medida (opcional) ─────────────────────── */}
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">Se vende por medida</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Actívalo si vendes fracciones de un envase: perfume por mililitro,
                  azúcar por kilo, tela por metro. Si vendes unidades enteras,
                  déjalo apagado.
                </p>
              </div>
              <Switch
                checked={porMedida}
                onCheckedChange={setPorMedida}
                aria-label="Se vende por medida"
              />
            </div>

            {isEditMode && (
              <p className="text-xs text-muted-foreground mt-3">
                Solo se puede cambiar mientras el producto no tenga movimientos
                de inventario: un stock de 300 pasaría de significar 300
                unidades a 300 mililitros, y el historial quedaría mintiendo.
              </p>
            )}

            {porMedida && (
              <div className="mt-5 border-t pt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="unidadBase">¿En qué se mide?</Label>
                    <Select value={unidadBase} onValueChange={setUnidadBase}>
                      <SelectTrigger id="unidadBase" className="mt-1">
                        <SelectValue placeholder="Elegir unidad" />
                      </SelectTrigger>
                      <SelectContent>
                        {unidadesMedibles.map((u) => (
                          <SelectItem key={u.code} value={u.code}>
                            {u.name} ({u.symbol})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="contenido">¿Cuánto trae cada envase?</Label>
                    <div className="relative mt-1">
                      <Input
                        id="contenido"
                        type="number"
                        min="1"
                        value={contenido || ""}
                        onChange={(e) => setContenido(parseInt(e.target.value) || 0)}
                        placeholder="Ej: 100"
                        className="pr-14"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        {unidadElegida?.symbol ?? ""}
                      </span>
                    </div>
                    {errors.contenido && (
                      <p className="text-sm text-red-500 mt-1">{errors.contenido}</p>
                    )}
                  </div>
                </div>

                <div className="sm:max-w-[50%]">
                  <Label htmlFor="precioPorMedida">
                    ¿Cuánto cobras por {unidadElegida?.symbol ?? "medida"}?
                  </Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      Bs
                    </span>
                    <Input
                      id="precioPorMedida"
                      type="number"
                      min="0"
                      step="0.01"
                      value={precioPorMedida || ""}
                      onChange={(e) =>
                        setPrecioPorMedida(parseFloat(e.target.value) || 0)
                      }
                      placeholder="Ej: 10"
                      className="pl-9"
                    />
                  </div>
                  {errors.precioPorMedida && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.precioPorMedida}
                    </p>
                  )}
                </div>

                {contenido > 0 && unidadElegida && precioPorMedida > 0 && (
                  <div className="rounded-md border bg-muted/40 p-3 space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      Con esto, tu producto se podrá vender de tres formas
                    </p>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between gap-3">
                        <span>Envase completo</span>
                        <span className="font-medium tabular-nums">
                          Bs {(formData.price || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span>
                          Por medida — 10 {unidadElegida.symbol}
                        </span>
                        <span className="font-medium tabular-nums">
                          Bs {(precioPorMedida * 10).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3 text-muted-foreground">
                        <span>Packs que arme el cliente</span>
                        <span>según lo que elija</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1 border-t">
                      Qué medidas se ofrecen —10, 20, 30 {unidadElegida.symbol}—
                      lo decide cada tienda en su web. Acá solo va el precio.
                    </p>
                  </div>
                )}

                {contenido > 0 && unidadElegida && (
                  <div className="rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">
                    Tu stock se contará en{" "}
                    <span className="font-medium text-foreground">
                      {unidadElegida.name.toLowerCase()}
                    </span>
                    . Un envase equivale a{" "}
                    <span className="font-medium text-foreground">
                      {contenido} {unidadElegida.symbol}
                    </span>
                    , así que 3 envases son {contenido * 3} {unidadElegida.symbol}.
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Featured */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-2">
                <div>
                  <h3 className="font-semibold">Producto Destacado</h3>
                  <p className="text-sm text-muted-foreground">
                    Aparecerá en la portada de tu tienda online
                  </p>
                </div>
                <HintIcon>
                  Los productos destacados se muestran al inicio de tu tienda online, en la sección hero. Úsalos para tus mejores ofertas o lanzamientos.
                </HintIcon>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.metadata?.isFeatured || false}
                  onChange={(e) =>
                    setFormData(prev => ({
                      ...prev,
                      metadata: { ...prev.metadata, isFeatured: e.target.checked }
                    }))
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
              </label>
            </div>
          </Card>

          {/* Tags */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Etiquetas</h2>
              <HintIcon>
                Palabras clave que describen tu producto (ej: "verano", "algodón", "unisex"). Cuando un cliente busca en tu tienda online, las etiquetas ayudan a que encuentre el producto. Mientras más relevantes, mejor.
              </HintIcon>
              <AiFieldButton
                storeId={formData.storeId}
                field="tags"
                currentValues={aiContext}
                onResult={(value) => {
                  if (Array.isArray(value)) {
                    const existing = formData.metadata?.tags || [];
                    const merged = [...new Set([...existing, ...value])];
                    setFormData(prev => ({ ...prev, metadata: { ...prev.metadata, tags: merged } }));
                  }
                }}
              />
              <BotonImportar
                onClick={() => setImportarTags(true)}
                title="Pegar una lista de etiquetas y cargarlas de golpe"
              />
            </div>

            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Agregar etiqueta..."
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
              />
              <Button type="button" onClick={handleAddTag} disabled={!tagInput.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {formData.metadata?.tags && formData.metadata.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.metadata.tags.map((tag, index) => (
                  <div
                    key={index}
                    className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-full"
                  >
                    <Tag className="h-3 w-3" />
                    <span className="text-sm">{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-red-600 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </form>

      {/* Reseñas del producto (solo en edición) */}
      {isEditMode && productId && formData.storeId && (
        <Card className="p-6">
          <StoreReviewsManager storeId={formData.storeId} productId={productId} />
        </Card>
      )}

      {/* Modals */}
      <ImageUploadModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        images={formData.imageUrls || []}
        onImagesChange={(images) => setFormData(prev => ({ ...prev, imageUrls: images }))}
      />

      <CreateBrandModal
        isOpen={isBrandModalOpen}
        onClose={() => setIsBrandModalOpen(false)}
      />

      <CreateCategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
      />

      <ImportarEspecificacionesModal
        open={importarSpecs}
        onOpenChange={setImportarSpecs}
        existentes={formData.metadata?.specifications || {}}
        onImportar={handleImportSpecifications}
      />

      <ImportarEtiquetasModal
        open={importarTags}
        onOpenChange={setImportarTags}
        existentes={formData.metadata?.tags || []}
        onImportar={handleImportTags}
      />
    </div>
    </TooltipProvider>
  );
}

/** El código como viene impreso: el GTIN-14 guardado sin su relleno de ceros. */
/** Lo que el catálogo puede llenar del formulario. */
type CampoCatalogo = "name" | "description" | "imageUrls" | "tags" | "specifications";

/** Vacío para el formulario: texto en blanco, lista sin nada, objeto sin claves. */
function vacio(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return !v.trim();
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}

const igual = (a: unknown, b: unknown) => b !== undefined && JSON.stringify(a) === JSON.stringify(b);

/** Para comparar nombres: "Dulces y Mermeladas" = "dulces y mermeladas". */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** El cursor al campo que falta, una vez que el formulario se redibujó. */
function enfocar(id: string) {
  window.setTimeout(() => {
    const campo = document.getElementById(id) as HTMLInputElement | null;
    campo?.focus();
    campo?.select?.();
  }, 60);
}

/**
 * La IA mejora la foto y arma la ficha la primera vez que alguien escanea el
 * código (10-30 s). Mientras tanto se avisa; al terminar, lo nuevo reemplaza
 * lo del catálogo que la persona no tocó.
 */
function SeguirIa({ resultado, onListo }: { resultado: ResultadoEscaneo; onListo: (ia: EnriquecimientoIa) => void }) {
  const { ia, generando } = useEnriquecimientoIa(resultado);
  const avisado = useRef(false);
  const alListo = useRef(onListo);
  alListo.current = onListo;
  useEffect(() => {
    if (ia?.estado !== "listo" || avisado.current) return;
    avisado.current = true;
    alListo.current(ia);
  }, [ia]);
  if (!generando) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" aria-hidden />
      La IA está mejorando la foto y armando la ficha…
    </p>
  );
}

function codigoLegible(codigo?: string | null): string {
  if (!codigo) return "";
  if (!/^\d{14}$/.test(codigo)) return codigo;
  return codigo.startsWith("000000") ? codigo.slice(6) : codigo.replace(/^0/, "");
}

function HintIcon({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger type="button" tabIndex={-1}>
        <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs text-xs leading-relaxed">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
