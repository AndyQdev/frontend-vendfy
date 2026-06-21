import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Image as ImageIcon,
  Info,
  Plus,
  Tag,
  X,
  ListChecks,
  Layers,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Card } from "@/shared/ui/card";
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
import { ImageUploadModal } from "@/shared/ui/image-upload-modal";
import { CreateBrandModal } from "@/features/product/ui/CreateBrandModal";
import { CreateCategoryModal } from "@/features/product/ui/CreateCategoryModal";
import {
  useBrands,
  useCategories,
  useCreateProduct,
} from "@/entities/product/api";
import type { Product } from "@/entities/product/model/types";
import type { ProductInput } from "@/entities/product/model/schema";
import { useStore } from "@/app/providers/auth";
import { toast } from "sonner";

interface CopyProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceProduct: Product | null;
}

const emptyForm: ProductInput = {
  name: "",
  description: "",
  imageUrls: [],
  sku: "",
  categoryId: "",
  brandId: "",
  storeId: "",
  price: 0,
  initialStock: 0,
  metadata: {
    isFeatured: false,
    tags: [],
    specifications: {},
  },
};

export function CopyProductModal({
  isOpen,
  onClose,
  sourceProduct,
}: CopyProductModalProps) {
  const { selectedStore } = useStore();
  const activeStoreId =
    typeof selectedStore === "object" && selectedStore ? selectedStore.id : "";

  const [activeTab, setActiveTab] = useState("basic");
  const [formData, setFormData] = useState<ProductInput>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tagInput, setTagInput] = useState("");
  const [specKey, setSpecKey] = useState("");
  const [specValue, setSpecValue] = useState("");
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const { data: categoriesData } = useCategories();
  const { data: brandsData } = useBrands();
  const categories = categoriesData || [];
  const brands = brandsData || [];

  const createProduct = useCreateProduct();

  // Resolver el precio del producto fuente: prioriza el campo plano `price`
  // (presente cuando se filtra por una tienda), luego el storeProduct de la
  // tienda activa, y como fallback el primero disponible.
  const resolveSourcePrice = (product: Product, storeId: string) => {
    if (typeof product.price === "number" && product.price > 0) return product.price;
    const matched = product.storeProducts?.find((sp) => sp.store?.id === storeId);
    if (matched) return matched.price;
    return product.storeProducts?.[0]?.price ?? 0;
  };

  // Cargar los datos del producto cuando se abre la modal
  useEffect(() => {
    if (!isOpen || !sourceProduct) return;

    setFormData({
      name: `${sourceProduct.name} (copia)`,
      description: sourceProduct.description ?? "",
      imageUrls: sourceProduct.imageUrls ?? [],
      sku: "", // El SKU es único: lo dejamos vacío para que el usuario lo defina
      categoryId: sourceProduct.category?.id ?? "",
      brandId: sourceProduct.brand?.id ?? "",
      storeId: activeStoreId,
      price: resolveSourcePrice(sourceProduct, activeStoreId),
      initialStock: 0,
      metadata: {
        isFeatured: sourceProduct.metadata?.isFeatured ?? false,
        tags: [...(sourceProduct.metadata?.tags ?? [])],
        specifications: { ...(sourceProduct.metadata?.specifications ?? {}) },
      },
    });
    setActiveTab("basic");
    setErrors({});
    setTagInput("");
    setSpecKey("");
    setSpecValue("");
  }, [isOpen, sourceProduct, activeStoreId]);

  // Contexto para los botones de IA (siempre actualizado con el form)
  const aiContext = useMemo(
    () => ({
      name: formData.name,
      description: formData.description,
      tags: formData.metadata?.tags,
      specifications: formData.metadata?.specifications,
      categoryName: categories.find((c) => c.id === formData.categoryId)?.name,
      brandName: brands.find((b) => b.id === formData.brandId)?.name,
    }),
    [formData, categories, brands],
  );

  const totalImages = formData.imageUrls?.length ?? 0;
  const totalTags = formData.metadata?.tags?.length ?? 0;
  const totalSpecs = useMemo(
    () => Object.keys(formData.metadata?.specifications ?? {}).length,
    [formData.metadata?.specifications],
  );

  const handleAddTag = () => {
    const input = tagInput.trim();
    if (!input) return;

    if (input.includes("#")) {
      const hashtags = input
        .split(/[\s\n]+/)
        .map((tag) => tag.replace(/^#+/, "").trim())
        .filter(Boolean);
      const existing = formData.metadata?.tags ?? [];
      const merged = [...new Set([...existing, ...hashtags])];
      setFormData((prev) => ({
        ...prev,
        metadata: { ...prev.metadata, tags: merged },
      }));
    } else if (!formData.metadata?.tags?.includes(input)) {
      setFormData((prev) => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          tags: [...(prev.metadata?.tags ?? []), input],
        },
      }));
    }
    setTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        tags: prev.metadata?.tags?.filter((t) => t !== tag) ?? [],
      },
    }));
  };

  const handleAddSpec = () => {
    if (!specKey.trim() || !specValue.trim()) return;
    setFormData((prev) => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        specifications: {
          ...(prev.metadata?.specifications ?? {}),
          [specKey.trim()]: specValue.trim(),
        },
      },
    }));
    setSpecKey("");
    setSpecValue("");
  };

  const handleRemoveSpec = (key: string) => {
    setFormData((prev) => {
      const next = { ...(prev.metadata?.specifications ?? {}) };
      delete next[key];
      return {
        ...prev,
        metadata: { ...prev.metadata, specifications: next },
      };
    });
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};

    if (!formData.name.trim()) next.name = "El nombre es requerido";
    if (!formData.price || formData.price <= 0)
      next.price = "El precio debe ser mayor a 0";

    if (!formData.storeId || selectedStore === "all" || selectedStore === null) {
      toast.error("Selecciona una tienda específica antes de duplicar");
      next.storeId = "Tienda requerida";
    }

    setErrors(next);

    // Si el error está en la pestaña Básico, saltar a ella
    if (next.name || next.price) setActiveTab("basic");

    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      const payload = {
        ...formData,
        brandId: formData.brandId || undefined,
        categoryId: formData.categoryId || undefined,
        sku: formData.sku || undefined,
      };
      await createProduct.mutateAsync(payload);
      toast.success("Producto duplicado correctamente");
      onClose();
    } catch (error) {
      console.error("Error duplicando producto:", error);
      toast.error("Error al duplicar el producto");
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Duplicar producto
            </DialogTitle>
            <DialogDescription>
              {sourceProduct ? (
                <>
                  Estás creando una copia de{" "}
                  <span className="font-medium text-foreground">
                    "{sourceProduct.name}"
                  </span>
                  . Ajusta lo necesario y guarda como nuevo producto.
                </>
              ) : (
                "Cargando producto..."
              )}
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 overflow-hidden flex flex-col"
          >
            <TabsList className="grid w-full grid-cols-4 shrink-0">
              <TabsTrigger value="basic" className="gap-1.5">
                <Info className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Básico</span>
              </TabsTrigger>
              <TabsTrigger value="images" className="gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Imágenes</span>
                {totalImages > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    ({totalImages})
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="organization" className="gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Organización</span>
              </TabsTrigger>
              <TabsTrigger value="details" className="gap-1.5">
                <ListChecks className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Detalles</span>
                {totalTags + totalSpecs > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    ({totalTags + totalSpecs})
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto pt-4 pr-1">
              {/* === BÁSICO === */}
              <TabsContent value="basic" className="mt-0 space-y-4">
                <Card className="p-4 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Label htmlFor="copy-name">
                        Nombre <span className="text-red-500">*</span>
                      </Label>
                      <HintIcon>
                        Cambia el nombre para distinguir esta copia del original.
                      </HintIcon>
                    </div>
                    <Input
                      id="copy-name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, name: e.target.value }))
                      }
                      className={errors.name ? "border-red-500" : ""}
                      placeholder="Ej: iPhone 15 Pro Max (copia)"
                    />
                    {errors.name && (
                      <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Label htmlFor="copy-sku">SKU</Label>
                      <HintIcon>
                        El SKU es único por producto: si lo dejas vacío se generará
                        automáticamente. No puede ser igual al original.
                      </HintIcon>
                    </div>
                    <Input
                      id="copy-sku"
                      value={formData.sku}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, sku: e.target.value }))
                      }
                      placeholder="Ej: IPH15PM-256-BLK-V2"
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Label htmlFor="copy-description">Descripción</Label>
                      <HintIcon>
                        Pulsa <span className="font-medium">IA</span> para
                        regenerar la descripción basada en el nombre y los
                        atributos del producto.
                      </HintIcon>
                      <AiFieldButton
                        storeId={formData.storeId}
                        field="description"
                        currentValues={aiContext}
                        onResult={(value) =>
                          setFormData((prev) => ({ ...prev, description: value }))
                        }
                      />
                    </div>
                    <textarea
                      id="copy-description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, description: e.target.value }))
                      }
                      rows={4}
                      className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none text-sm"
                      placeholder="Describe el producto..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Label htmlFor="copy-price">
                          Precio <span className="text-red-500">*</span>
                        </Label>
                      </div>
                      <Input
                        id="copy-price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.price}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            price: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className={errors.price ? "border-red-500" : ""}
                        placeholder="999.99"
                      />
                      {errors.price && (
                        <p className="text-sm text-red-500 mt-1">{errors.price}</p>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Label htmlFor="copy-stock">Stock inicial</Label>
                        <HintIcon>
                          Cuántas unidades tienes hoy para esta copia. Empieza en 0
                          y luego registra una compra para cargar stock.
                        </HintIcon>
                      </div>
                      <Input
                        id="copy-stock"
                        type="number"
                        min="0"
                        value={formData.initialStock}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            initialStock: parseInt(e.target.value) || 0,
                          }))
                        }
                        placeholder="0"
                      />
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* === IMÁGENES === */}
              <TabsContent value="images" className="mt-0 space-y-4">
                <Card className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-sm">
                        Imágenes del producto
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Se copiaron del producto original. Puedes agregar o quitar.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsImageModalOpen(true)}
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      {totalImages > 0
                        ? `Gestionar (${totalImages})`
                        : "Agregar"}
                    </Button>
                  </div>

                  {totalImages > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {formData.imageUrls!.map((url, index) => (
                        <div
                          key={`${url}-${index}`}
                          className="relative aspect-square group"
                        >
                          <img
                            src={url}
                            alt={`Producto ${index + 1}`}
                            className="w-full h-full object-cover rounded-lg border"
                          />
                          <div className="absolute top-1.5 left-1.5 bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                            {index + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 border-2 border-dashed rounded-lg">
                      <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Sin imágenes
                      </p>
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* === ORGANIZACIÓN === */}
              <TabsContent value="organization" className="mt-0 space-y-4">
                <Card className="p-4 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Label>Categoría</Label>
                      <HintIcon>
                        Agrupa productos del mismo tipo. Crea una nueva con el
                        botón +.
                      </HintIcon>
                    </div>
                    <div className="flex gap-2">
                      <Select
                        value={formData.categoryId}
                        onValueChange={(value) =>
                          setFormData((p) => ({ ...p, categoryId: value }))
                        }
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
                    <div className="flex items-center gap-2 mb-1">
                      <Label>Marca</Label>
                      <HintIcon>El fabricante o casa del producto.</HintIcon>
                    </div>
                    <div className="flex gap-2">
                      <Select
                        value={formData.brandId}
                        onValueChange={(value) =>
                          setFormData((p) => ({ ...p, brandId: value }))
                        }
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

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-start gap-2">
                      <div>
                        <p className="font-semibold text-sm">
                          Producto destacado
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Aparece en la portada de la tienda online
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.metadata?.isFeatured ?? false}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            metadata: {
                              ...p.metadata,
                              isFeatured: e.target.checked,
                            },
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </Card>
              </TabsContent>

              {/* === DETALLES (Tags + Specs) === */}
              <TabsContent value="details" className="mt-0 space-y-4">
                {/* Tags */}
                <Card className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">Etiquetas</h3>
                    <HintIcon>
                      Palabras clave que ayudan a tus clientes a encontrar el
                      producto.
                    </HintIcon>
                    <AiFieldButton
                      storeId={formData.storeId}
                      field="tags"
                      currentValues={aiContext}
                      onResult={(value) => {
                        if (Array.isArray(value)) {
                          const existing = formData.metadata?.tags ?? [];
                          const merged = [...new Set([...existing, ...value])];
                          setFormData((prev) => ({
                            ...prev,
                            metadata: { ...prev.metadata, tags: merged },
                          }));
                        }
                      }}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="Agregar etiqueta..."
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        (e.preventDefault(), handleAddTag())
                      }
                    />
                    <Button
                      type="button"
                      onClick={handleAddTag}
                      disabled={!tagInput.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {totalTags > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {formData.metadata!.tags!.map((tag, index) => (
                        <div
                          key={`${tag}-${index}`}
                          className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full"
                        >
                          <Tag className="h-3 w-3" />
                          <span className="text-xs">{tag}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-0.5 hover:text-red-600 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Sin etiquetas
                    </p>
                  )}
                </Card>

                {/* Specifications */}
                <Card className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">Especificaciones</h3>
                    <HintIcon>
                      Datos técnicos clave-valor (ej: "Talla: M").
                    </HintIcon>
                    <AiFieldButton
                      storeId={formData.storeId}
                      field="specifications"
                      currentValues={aiContext}
                      onResult={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          metadata: {
                            ...prev.metadata,
                            specifications: {
                              ...(prev.metadata?.specifications ?? {}),
                              ...value,
                            },
                          },
                        }))
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={specKey}
                      onChange={(e) => setSpecKey(e.target.value)}
                      placeholder="Nombre (Ej: Pantalla)"
                    />
                    <div className="flex gap-2">
                      <Input
                        value={specValue}
                        onChange={(e) => setSpecValue(e.target.value)}
                        placeholder="Valor (Ej: 6.1)"
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          (e.preventDefault(), handleAddSpec())
                        }
                      />
                      <Button
                        type="button"
                        onClick={handleAddSpec}
                        disabled={!specKey.trim() || !specValue.trim()}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {totalSpecs > 0 ? (
                    <div className="space-y-1.5">
                      {Object.entries(
                        formData.metadata?.specifications ?? {},
                      ).map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-lg"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-xs text-emerald-900 dark:text-emerald-100 truncate">
                              {key}
                            </p>
                            <p className="text-xs text-emerald-700 dark:text-emerald-300 truncate">
                              {value}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveSpec(key)}
                            className="h-7 w-7 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 shrink-0"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Sin especificaciones
                    </p>
                  )}
                </Card>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="shrink-0 border-t pt-4 mt-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={createProduct.isPending}>
              <Copy className="h-4 w-4 mr-2" />
              {createProduct.isPending ? "Duplicando..." : "Crear copia"}
            </Button>
          </DialogFooter>
        </DialogContent>

        {/* Submodals */}
        <ImageUploadModal
          isOpen={isImageModalOpen}
          onClose={() => setIsImageModalOpen(false)}
          images={formData.imageUrls || []}
          onImagesChange={(images) =>
            setFormData((prev) => ({ ...prev, imageUrls: images }))
          }
        />

        <CreateBrandModal
          isOpen={isBrandModalOpen}
          onClose={() => setIsBrandModalOpen(false)}
        />

        <CreateCategoryModal
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
        />
      </Dialog>
    </TooltipProvider>
  );
}

function HintIcon({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger type="button" tabIndex={-1}>
        <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
      </TooltipTrigger>
      <TooltipContent
        side="right"
        className="max-w-xs text-xs leading-relaxed"
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
