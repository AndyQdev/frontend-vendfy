import { useState, useRef } from "react";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogBody as DialogBody,
} from "@/shared/ui/responsive-dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Badge } from "@/shared/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import {
  ListaTarjetas,
  SoloEscritorio,
  TarjetaFila,
  FilaAcciones,
} from "@/shared/ui/lista-tarjetas";
import {
  Upload,
  Sparkles,
  FileText,
  Image as ImageIcon,
  X,
  Trash2,
  Loader2,
  CheckCircle,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { CategoryIcon } from "@/shared/ui/category-icon";
import { apiFetch } from "@/shared/api/client";
import { AiModelPicker } from "@/shared/ui/ai-model-picker";
import { SpecsCell } from "./SpecsCell";
import { DescripcionCell } from "./DescripcionCell";
import { useModeloIa } from "@/shared/hooks/use-modelo-ia";
import { useStore, useAuth } from "@/app/providers/auth";
import { useQueryClient } from "@tanstack/react-query";
import type { ProductInput } from "@/entities/product/model/schema";

interface AiGeneratedProduct {
  name: string;
  description: string;
  price: number;
  stockQuantity: number;
  categoryName?: string;
  categoryIcon?: string;
  tags?: string[];
  specifications?: Record<string, string>;
}

interface NewCategory {
  name: string;
  icon?: string;
}

interface PrepareResponse {
  chunks: string[];
  totalChunks: number;
  categories: string[];
  isImage: boolean;
  imageBase64?: string;
}

interface ChunkResponse {
  products: AiGeneratedProduct[];
}

interface AiGenerateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_IMAGE = "https://static.vecteezy.com/system/resources/previews/005/723/771/non_2x/photo-album-icon-image-symbol-or-no-image-flat-design-on-a-white-background-vector.jpg";

export function AiGenerateModal({ open, onOpenChange }: AiGenerateModalProps) {
  const { selectedStore } = useStore();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { modelo } = useModeloIa();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [userPrompt, setUserPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [generatedProducts, setGeneratedProducts] = useState<AiGeneratedProduct[]>([]);
  const [newCategories, setNewCategories] = useState<NewCategory[]>([]);
  const [step, setStep] = useState<"upload" | "processing" | "review">("upload");

  // Progress state
  const [progress, setProgress] = useState({ current: 0, total: 0, productsFound: 0 });

  const storeId = selectedStore && selectedStore !== "all" ? selectedStore.id : undefined;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getFileIcon = (mimetype: string) => {
    if (mimetype.startsWith("image/")) return <ImageIcon className="h-5 w-5 text-purple-500" />;
    return <FileText className="h-5 w-5 text-blue-500" />;
  };

  const handleGenerate = async () => {
    if (!file) {
      toast.error("Selecciona un archivo o imagen");
      return;
    }

    setIsGenerating(true);
    setStep("processing");
    setProgress({ current: 0, total: 0, productsFound: 0 });
    setGeneratedProducts([]);

    try {
      // Step 1: Prepare - upload file, get chunks
      const formData = new FormData();
      formData.append("file", file);

      const prepareRes = await apiFetch<PrepareResponse>("/api/product/ai/prepare", {
        method: "POST",
        body: formData,
      });

      const prepData = prepareRes.data;
      if (!prepData) throw new Error("Error al preparar archivo");

      const { chunks, totalChunks, categories, isImage, imageBase64 } = prepData;
      setProgress({ current: 0, total: totalChunks, productsFound: 0 });

      // Step 2: Process chunks one by one
      let allProducts: AiGeneratedProduct[] = [];

      for (let i = 0; i < totalChunks; i++) {
        setProgress(prev => ({ ...prev, current: i + 1 }));

        const chunkRes = await apiFetch<ChunkResponse>("/api/product/ai/process-chunk", {
          method: "POST",
          body: {
            chunk: isImage ? undefined : chunks[i],
            imageBase64: isImage ? imageBase64 : undefined,
            isImage,
            chunkIndex: i,
            totalChunks,
            categories,
            prompt: userPrompt.trim() || undefined,
            ...modelo,
          },
        });

        const chunkProducts = (chunkRes.data?.products || []).map(p => ({
          ...p,
          price: p.price > 0 ? p.price : 1,
        }));
        allProducts = [...allProducts, ...chunkProducts];
        setProgress(prev => ({ ...prev, productsFound: allProducts.length }));
      }

      if (allProducts.length === 0) {
        toast.error("No se encontraron productos en el archivo");
        setStep("upload");
        return;
      }

      // Detect new categories con su ícono (el primero que mande la IA por categoría)
      const catLower = categories.map(c => c.toLowerCase());
      const newCatsMap = new Map<string, NewCategory>();
      for (const p of allProducts) {
        if (!p.categoryName) continue;
        const lower = p.categoryName.toLowerCase();
        if (catLower.includes(lower) || newCatsMap.has(lower)) continue;
        newCatsMap.set(lower, {
          name: p.categoryName,
          icon: p.categoryIcon || undefined,
        });
      }
      const newCats = Array.from(newCatsMap.values());

      setGeneratedProducts(allProducts);
      setNewCategories(newCats);
      setStep("review");
      toast.success(`${allProducts.length} productos generados`);
    } catch (error: any) {
      console.error("Error generating products:", error);
      toast.error(error?.message || "Error al generar productos con IA");
      setStep("upload");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleProductChange = (index: number, field: keyof AiGeneratedProduct, value: any) => {
    setGeneratedProducts(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveProduct = (index: number) => {
    setGeneratedProducts(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateAll = async () => {
    if (!storeId) {
      toast.error("Selecciona una tienda específica antes de crear productos");
      return;
    }

    setIsCreating(true);
    try {
      const categoryMap: Record<string, string> = {};

      // 1. Create new categories in batch (single request)
      if (newCategories.length > 0 && user?.id) {
        try {
          await apiFetch("/api/category/batch", {
            method: "POST",
            body: {
              userId: user.id,
              categories: newCategories.map((c) => ({ name: c.name, icon: c.icon })),
            },
          });
        } catch {
          // Some categories might already exist, continue
        }
      }

      // 2. Get all categories to map names to IDs
      const catResponse = await apiFetch<Array<{ id: string; name: string }>>("/api/category");
      const allCategories = catResponse.data || [];
      for (const cat of allCategories) {
        categoryMap[cat.name.toLowerCase()] = cat.id;
      }

      // 3. Create products batch - ensure price > 0 (backend requires positive)
      const products: ProductInput[] = generatedProducts.map(p => ({
        name: p.name,
        description: p.description,
        imageUrls: [DEFAULT_IMAGE],
        price: p.price > 0 ? p.price : 1,
        initialStock: p.stockQuantity || 0,
        storeId,
        categoryId: p.categoryName ? categoryMap[p.categoryName.toLowerCase()] : undefined,
        metadata: {
          tags: p.tags || [],
          specifications: p.specifications || {},
        },
      }));

      await apiFetch("/api/product/batch", {
        method: "POST",
        body: { products },
      });

      toast.success(`${products.length} productos creados exitosamente`);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      handleClose();
    } catch (error: any) {
      console.error("Error creating products:", error);
      toast.error(error?.message || "Error al crear productos");
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (isGenerating) return; // Don't close while processing
    setFile(null);
    setUserPrompt("");
    setGeneratedProducts([]);
    setNewCategories([]);
    setStep("upload");
    setProgress({ current: 0, total: 0, productsFound: 0 });
    setIsGenerating(false);
    setIsCreating(false);
    onOpenChange(false);
  };

  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Crear Productos con IA
            </DialogTitle>
            {/* El selector va acá arriba porque la elección aplica a todo lo
                que se genere después, no a un campo suelto. */}
            <AiModelPicker className="mr-6 shrink-0" />
          </div>
          <DialogDescription>
            {step === "upload" && "Sube un archivo o imagen y la IA generará productos automáticamente"}
            {step === "processing" && "Procesando archivo con IA..."}
            {step === "review" && `${generatedProducts.length} productos generados. Revisa y edita antes de crear.`}
          </DialogDescription>
        </DialogHeader>

      <DialogBody>
        {/* ===== STEP: UPLOAD ===== */}
        {step === "upload" && (
          <div className="space-y-5">
            <div>
              <Label className="text-sm font-medium">Archivo o imagen</Label>
              <div
                className="mt-2 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    {getFileIcon(file.type)}
                    <div className="text-left">
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">Click para seleccionar archivo</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, Word, Excel, CSV, TXT o Imagen (JPG, PNG, WEBP)
                    </p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.xlsx,.xls,.txt,.csv,.jpg,.jpeg,.png,.webp,.gif,image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div>
              <Label htmlFor="ai-prompt" className="text-sm font-medium">
                Instrucciones para la IA (opcional)
              </Label>
              <Textarea
                id="ai-prompt"
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="Ej: Quiero que los productos tengan nombres creativos, precios en bolivianos, stock de 5 unidades cada uno..."
                rows={3}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                La IA priorizará tus instrucciones sobre las reglas generales
              </p>
            </div>

            {!storeId && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Selecciona una tienda específica en el sidebar para poder crear productos
                </p>
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={!file || isGenerating}
              className="w-full"
              size="lg"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generar Productos
            </Button>
          </div>
        )}

        {/* ===== STEP: PROCESSING (Progress) ===== */}
        {step === "processing" && (
          <div className="py-8 space-y-6">
            <div className="text-center">
              <div className="relative inline-flex items-center justify-center mb-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <Sparkles className="h-5 w-5 text-primary absolute" />
              </div>
              <h3 className="text-lg font-semibold">
                {progress.total === 0
                  ? "Preparando archivo..."
                  : `Analizando con IA...`
                }
              </h3>
              {progress.total > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  Procesando parte {progress.current} de {progress.total}
                </p>
              )}
            </div>

            {/* Progress Bar */}
            {progress.total > 0 && (
              <div className="space-y-2 max-w-md mx-auto">
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{progressPercent}%</span>
                  <span>
                    {progress.productsFound > 0
                      ? `${progress.productsFound} productos encontrados`
                      : "Buscando productos..."
                    }
                  </span>
                </div>
              </div>
            )}

            <p className="text-xs text-center text-muted-foreground">
              Esto puede tomar unos segundos por cada parte del archivo
            </p>
          </div>
        )}

        {/* ===== STEP: REVIEW ===== */}
        {step === "review" && (
          <div className="space-y-4">
            {newCategories.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                  Nuevas categorías que se crearán:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {newCategories.map((cat) => (
                    <Badge key={cat.name} variant="secondary" className="gap-1.5 py-1">
                      <CategoryIcon name={cat.icon} size={14} />
                      {cat.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Scroll en vez de recortar: con la columna nueva son siete, y
                entre md y lg `overflow-hidden` se comía la última sin avisar.
                Más abajo de md ya no hay tabla, sino tarjetas. */}
            <SoloEscritorio className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Nombre</TableHead>
                    <TableHead className="w-[80px]">Precio</TableHead>
                    <TableHead className="w-[60px]">Stock</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead className="w-[90px]">Descripción</TableHead>
                    <TableHead className="w-[110px]">Especificaciones</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {generatedProducts.map((product, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          value={product.name}
                          onChange={(e) => handleProductChange(index, "name", e.target.value)}
                          className="h-8 md:text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={product.price}
                          onChange={(e) => handleProductChange(index, "price", parseFloat(e.target.value) || 0)}
                          className="h-8 w-20 md:text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={product.stockQuantity}
                          onChange={(e) => handleProductChange(index, "stockQuantity", parseInt(e.target.value) || 0)}
                          className="h-8 w-16 md:text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {product.categoryName || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {product.tags?.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs py-0">{tag}</Badge>
                          ))}
                          {(product.tags?.length || 0) > 2 && (
                            <Badge variant="outline" className="text-xs py-0">+{product.tags!.length - 2}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DescripcionCell
                          value={product.description}
                          onChange={(v) => handleProductChange(index, "description", v)}
                        />
                      </TableCell>
                      <TableCell>
                        <SpecsCell
                          value={product.specifications}
                          onChange={(specs) => handleProductChange(index, "specifications", specs)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveProduct(index)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </SoloEscritorio>

            {/* En el teléfono esto es una hoja angosta: ocho columnas con
                campos editables no se revisan de costado, se revisan de a uno. */}
            <ListaTarjetas>
              {generatedProducts.map((product, index) => (
                <TarjetaFila
                  key={index}
                  acciones={
                    <FilaAcciones className="justify-between">
                      <div className="flex items-center gap-2">
                        <DescripcionCell
                          value={product.description}
                          onChange={(v) => handleProductChange(index, "description", v)}
                        />
                        <SpecsCell
                          value={product.specifications}
                          onChange={(specs) =>
                            handleProductChange(index, "specifications", specs)
                          }
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleRemoveProduct(index)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Quitar
                      </Button>
                    </FilaAcciones>
                  }
                >
                  <Input
                    value={product.name}
                    onChange={(e) => handleProductChange(index, "name", e.target.value)}
                    className="h-9 font-medium"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="etiqueta block text-[10px] text-muted-foreground">
                        Precio
                      </span>
                      <Input
                        type="number"
                        value={product.price}
                        onChange={(e) =>
                          handleProductChange(
                            index,
                            "price",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="h-9"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="etiqueta block text-[10px] text-muted-foreground">
                        Stock
                      </span>
                      <Input
                        type="number"
                        value={product.stockQuantity}
                        onChange={(e) =>
                          handleProductChange(
                            index,
                            "stockQuantity",
                            parseInt(e.target.value) || 0,
                          )
                        }
                        className="h-9"
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    <span className="mr-1 text-xs text-muted-foreground">
                      {product.categoryName || "—"}
                    </span>
                    {product.tags?.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="outline" className="py-0 text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {(product.tags?.length || 0) > 2 && (
                      <Badge variant="outline" className="py-0 text-xs">
                        +{product.tags!.length - 2}
                      </Badge>
                    )}
                  </div>
                </TarjetaFila>
              ))}
            </ListaTarjetas>

            {generatedProducts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Todos los productos fueron eliminados</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Volver
              </Button>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {generatedProducts.length} productos
                </span>
                <Button
                  onClick={handleCreateAll}
                  disabled={generatedProducts.length === 0 || isCreating || !storeId}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Crear {generatedProducts.length} Productos
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

      </DialogBody>

      </DialogContent>
    </Dialog>
  );
}
