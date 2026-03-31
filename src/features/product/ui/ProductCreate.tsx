import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Image as ImageIcon, Plus, X, Tag } from "lucide-react";
import { AiFieldButton } from "@/shared/ui/ai-field-button";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Card } from "@/shared/ui/card";
import { ImageUploadModal } from "@/shared/ui/image-upload-modal";
import { CreateBrandModal } from "@/features/product/ui/CreateBrandModal";
import { CreateCategoryModal } from "@/features/product/ui/CreateCategoryModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { useStore } from "@/app/providers/auth";
import { useProduct, useCreateProduct, useUpdateProduct, useCategories, useBrands } from "@/entities/product/api";
import type { ProductInput } from "@/entities/product/model/schema";
import { toast } from "sonner";

export default function CreateProduct() {
  const navigate = useNavigate();
  const { id: productId } = useParams();
  const { selectedStore } = useStore();
  const isEditMode = Boolean(productId);

  // State for form data
  const [formData, setFormData] = useState<ProductInput>({
    name: "",
    description: "",
    imageUrls: [],
    sku: "",
    categoryId: "",
    brandId: "",
    storeId: typeof selectedStore === "object" ? selectedStore?.id || "" : "",
    price: 0,
    initialStock: 0,
    metadata: {
      isFeatured: false,
      tags: [],
      specifications: {}
    }
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [specificationKey, setSpecificationKey] = useState("");
  const [specificationValue, setSpecificationValue] = useState("");

  // API calls
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const { data: categoriesData } = useCategories();
  const { data: brandsData } = useBrands();

  // Load existing product in edit mode
  const { data: existingProduct } = useProduct(productId);

  useEffect(() => {
    if (existingProduct && isEditMode) {
      console.log("Loading existing product:", existingProduct);
      console.log("Category ID:", existingProduct.category?.id);
      console.log("Brand ID:", existingProduct.brand?.id);
      
      setFormData({
        name: existingProduct.name || "",
        description: existingProduct.description || "",
        imageUrls: existingProduct.imageUrls || [],
        sku: existingProduct.sku || "",
        categoryId: existingProduct.category?.id || "",
        brandId: existingProduct.brand?.id || "",
        storeId: typeof selectedStore === "object" ? selectedStore?.id || "" : "",
        price: 0,
        initialStock: 0,
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

    // Validar que haya una tienda seleccionada válida
    if (!formData.storeId || selectedStore === "all" || selectedStore === null) {
      newErrors.storeId = "Debes seleccionar una tienda específica";
      toast.error("Por favor selecciona una tienda antes de crear el producto");
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
      };

      if (isEditMode && productId) {
        await updateProduct.mutateAsync({ id: productId, data: payload });
        toast.success("Producto actualizado correctamente");
      } else {
        await createProduct.mutateAsync(payload);
        toast.success("Producto creado correctamente");
      }
      navigate("/products");
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error(isEditMode ? "Error al actualizar el producto" : "Error al crear el producto");
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/products")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isEditMode ? "Editar Producto" : "Crear Nuevo Producto"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEditMode
                ? "Modifica la información del producto"
                : "Completa la información del nuevo producto"}
            </p>
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={createProduct.isPending || updateProduct.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {createProduct.isPending || updateProduct.isPending
            ? "Guardando..."
            : isEditMode
            ? "Actualizar"
            : "Crear Producto"}
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Información Básica</h2>
            
            <div>
              <Label htmlFor="name">
                Nombre del Producto <span className="text-red-500">*</span>
              </Label>
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

            <div>
              <Label htmlFor="sku">SKU (Opcional)</Label>
              <Input
                id="sku"
                name="sku"
                value={formData.sku}
                onChange={handleInputChange}
                placeholder="Ej: IPH15PM-256-BLK"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <Label htmlFor="description">Descripción</Label>
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
              <Label htmlFor="category">Categoría</Label>
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
                        {category.name}
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
              <Label htmlFor="brand">Marca</Label>
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
              <Label htmlFor="price">
                Precio <span className="text-red-500">*</span>
              </Label>
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
              <Label htmlFor="initialStock">Stock Inicial</Label>
              <Input
                id="initialStock"
                name="initialStock"
                type="number"
                min="0"
                value={formData.initialStock}
                onChange={(e) => setFormData(prev => ({ ...prev, initialStock: parseInt(e.target.value) || 0 }))}
                placeholder="Ej: 10"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Cantidad inicial de productos en inventario (por defecto 0)
              </p>
            </div>
          </Card>

          {/* Featured */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Producto Destacado</h3>
                <p className="text-sm text-muted-foreground">
                  Aparecerá en la página principal
                </p>
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
        storeId={formData.storeId}
      />

      <CreateCategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        storeId={formData.storeId}
      />
    </div>
  );
}
