import { useRef, useState } from "react";
import {
  Star,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Upload,
  X,
  MessageSquareQuote,
  Package,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Card } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { toast } from "sonner";
import {
  useStoreReviews,
  useCreateReview,
  useUpdateReview,
  useDeleteReview,
  uploadReviewImage,
  deleteReviewImage,
} from "@/entities/review/api";
import type { Review } from "@/entities/review/model/types";
import { useProducts } from "@/entities/product/api";

interface StoreReviewsManagerProps {
  storeId: string;
  // Si se pasa, el manager queda fijado a ese producto (editor de producto)
  productId?: string;
}

interface ReviewFormState {
  customerName: string;
  rating: number | null;
  comment: string;
  imageUrls: string[];
  featured: boolean;
  published: boolean;
  productId: string | null;
}

const emptyForm: ReviewFormState = {
  customerName: "",
  rating: 5,
  comment: "",
  imageUrls: [],
  featured: false,
  published: true,
  productId: null,
};

// Relación URL -> path de Supabase para poder borrar imágenes recién subidas
const reviewImagePathMap = new Map<string, string>();

function StarRating({
  value,
  onChange,
  readOnly = false,
  size = "md",
}: {
  value: number | null;
  onChange?: (value: number | null) => void;
  readOnly?: boolean;
  size?: "sm" | "md";
}) {
  const starSize = size === "sm" ? "h-4 w-4" : "h-6 w-6";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = value !== null && star <= value;
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            aria-label={`${star} estrellas`}
            onClick={() => onChange?.(value === star ? null : star)}
            className={readOnly ? "cursor-default" : "cursor-pointer transition-transform hover:scale-110"}
          >
            <Star
              className={`${starSize} ${
                filled
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground/30"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

export function StoreReviewsManager({ storeId, productId }: StoreReviewsManagerProps) {
  const isProductScoped = Boolean(productId);
  const { data: reviews = [], isLoading } = useStoreReviews(storeId, productId);
  const { data: productsResponse } = useProducts({ limit: 200, storeId });
  const products = productsResponse?.data || [];

  const createReview = useCreateReview();
  const updateReview = useUpdateReview();
  const deleteReview = useDeleteReview();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [form, setForm] = useState<ReviewFormState>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<Review | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSaving = createReview.isPending || updateReview.isPending;

  const openCreate = () => {
    setEditingReview(null);
    setForm({ ...emptyForm, productId: productId ?? null });
    setDialogOpen(true);
  };

  const openEdit = (review: Review) => {
    setEditingReview(review);
    setForm({
      customerName: review.customerName,
      rating: review.rating,
      comment: review.comment || "",
      imageUrls: review.imageUrls || [],
      featured: review.featured,
      published: review.published,
      productId: review.product?.id ?? null,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.customerName.trim()) {
      toast.error("El nombre del cliente es obligatorio");
      return;
    }
    if (!form.comment.trim() && form.imageUrls.length === 0) {
      toast.error("Agrega un comentario o al menos una imagen");
      return;
    }

    const payload = {
      customerName: form.customerName.trim(),
      rating: form.rating,
      comment: form.comment.trim() || undefined,
      imageUrls: form.imageUrls,
      featured: form.featured,
      published: form.published,
      productId: form.productId,
    };

    try {
      if (editingReview) {
        await updateReview.mutateAsync({ id: editingReview.id, data: payload });
        toast.success("Reseña actualizada correctamente");
      } else {
        await createReview.mutateAsync({ ...payload, storeId });
        toast.success("Reseña creada correctamente");
      }
      setDialogOpen(false);
    } catch (error) {
      console.error("Error saving review:", error);
      toast.error("Error al guardar la reseña");
    }
  };

  const handleTogglePublished = async (review: Review) => {
    try {
      await updateReview.mutateAsync({
        id: review.id,
        data: { published: !review.published },
      });
      toast.success(review.published ? "Reseña oculta" : "Reseña visible en tu tienda");
    } catch {
      toast.error("Error al actualizar la reseña");
    }
  };

  const handleDelete = async () => {
    if (!reviewToDelete) return;
    try {
      await deleteReview.mutateAsync(reviewToDelete.id);
      toast.success("Reseña eliminada correctamente");
    } catch {
      toast.error("Error al eliminar la reseña");
    } finally {
      setReviewToDelete(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        try {
          const { url, path } = await uploadReviewImage(file);
          reviewImagePathMap.set(url, path);
          uploaded.push(url);
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          toast.error(`Error al subir ${file.name}`);
        }
      }
      if (uploaded.length > 0) {
        setForm((prev) => ({ ...prev, imageUrls: [...prev.imageUrls, ...uploaded] }));
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = async (url: string) => {
    const path = reviewImagePathMap.get(url);
    if (path) {
      try {
        await deleteReviewImage(path);
        reviewImagePathMap.delete(url);
      } catch (error) {
        console.error("Error al eliminar imagen del servidor:", error);
      }
    }
    setForm((prev) => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((img) => img !== url),
    }));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">
            {isProductScoped ? "Reseñas del Producto" : "Reseñas de Clientes"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isProductScoped
              ? "Testimonios y capturas de clientes sobre este producto"
              : "Sube fotos y capturas de tus clientes satisfechos: aparecerán en tu tienda online"}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Reseña
        </Button>
      </div>

      {/* Listado */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-lg" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-14 border-2 border-dashed rounded-lg">
          <MessageSquareQuote className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="font-medium">Aún no hay reseñas</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Agrega capturas de WhatsApp o fotos de tus clientes contentos
          </p>
          <Button variant="outline" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar mi primera reseña
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {reviews.map((review) => (
            <Card
              key={review.id}
              className={`overflow-hidden flex flex-col ${
                !review.published ? "opacity-60" : ""
              }`}
            >
              {/* Imágenes */}
              {review.imageUrls?.length > 0 && (
                <div className="relative aspect-video bg-muted">
                  <img
                    src={review.imageUrls[0]}
                    alt={`Reseña de ${review.customerName}`}
                    className="w-full h-full object-cover"
                  />
                  {review.imageUrls.length > 1 && (
                    <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                      +{review.imageUrls.length - 1} más
                    </span>
                  )}
                </div>
              )}

              <div className="p-4 flex-1 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{review.customerName}</p>
                    {review.rating !== null && (
                      <StarRating value={review.rating} readOnly size="sm" />
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {review.origin === "CUSTOMER" && (
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 hover:bg-blue-100">
                        <UserCheck className="h-3 w-3 mr-1" />
                        De cliente
                      </Badge>
                    )}
                    {review.featured && (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400 hover:bg-emerald-100">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Destacada
                      </Badge>
                    )}
                    {!review.published && (
                      <Badge variant="secondary">
                        <EyeOff className="h-3 w-3 mr-1" />
                        Oculta
                      </Badge>
                    )}
                  </div>
                </div>

                {review.comment && (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    "{review.comment}"
                  </p>
                )}

                {!isProductScoped && review.product && (
                  <Badge variant="outline" className="w-fit">
                    <Package className="h-3 w-3 mr-1" />
                    {review.product.name}
                  </Badge>
                )}

                <div className="mt-auto pt-2 flex items-center justify-between border-t">
                  <span className="text-xs text-muted-foreground">
                    {new Date(review.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={review.published ? "Ocultar reseña" : "Mostrar reseña"}
                      onClick={() => handleTogglePublished(review)}
                    >
                      {review.published ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Editar reseña"
                      onClick={() => openEdit(review)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      aria-label="Eliminar reseña"
                      onClick={() => setReviewToDelete(review)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog crear/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingReview ? "Editar Reseña" : "Nueva Reseña"}
            </DialogTitle>
            <DialogDescription>
              Agrega el testimonio y las fotos o capturas de tu cliente
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="review-customer">Nombre del cliente</Label>
              <Input
                id="review-customer"
                value={form.customerName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, customerName: e.target.value }))
                }
                placeholder="Ej: María G."
              />
            </div>

            <div className="space-y-2">
              <Label>Calificación</Label>
              <div className="flex items-center gap-3">
                <StarRating
                  value={form.rating}
                  onChange={(rating) => setForm((prev) => ({ ...prev, rating }))}
                />
                <span className="text-sm text-muted-foreground">
                  {form.rating ? `${form.rating} de 5` : "Sin calificación"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="review-comment">Comentario</Label>
              <Textarea
                id="review-comment"
                value={form.comment}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, comment: e.target.value }))
                }
                rows={3}
                placeholder="Lo que dijo tu cliente..."
              />
            </div>

            {!isProductScoped && (
              <div className="space-y-2">
                <Label>Producto (opcional)</Label>
                <Select
                  value={form.productId ?? "none"}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      productId: value === "none" ? null : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Reseña general de la tienda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      Reseña general de la tienda
                    </SelectItem>
                    {products.map((product: any) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Si la asocias a un producto, también aparecerá en su ficha
                </p>
              </div>
            )}

            {/* Imágenes */}
            <div className="space-y-2">
              <Label>Fotos / Capturas</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="grid grid-cols-3 gap-2">
                {form.imageUrls.map((url) => (
                  <div
                    key={url}
                    className="relative group aspect-square rounded-lg overflow-hidden border"
                  >
                    <img
                      src={url}
                      alt="Imagen de reseña"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      aria-label="Quitar imagen"
                      onClick={() => handleRemoveImage(url)}
                      className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current" />
                  ) : (
                    <>
                      <Upload className="h-5 w-5" />
                      <span className="text-xs">Subir</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Capturas de WhatsApp, fotos del producto entregado, etc.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Destacada</p>
                <p className="text-xs text-muted-foreground">
                  Se muestra primero en tu tienda
                </p>
              </div>
              <Switch
                checked={form.featured}
                onCheckedChange={(featured) =>
                  setForm((prev) => ({ ...prev, featured }))
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Visible en la tienda</p>
                <p className="text-xs text-muted-foreground">
                  Desactívala para ocultarla sin eliminarla
                </p>
              </div>
              <Switch
                checked={form.published}
                onCheckedChange={(published) =>
                  setForm((prev) => ({ ...prev, published }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving || uploading}>
              {isSaving
                ? "Guardando..."
                : editingReview
                ? "Guardar Cambios"
                : "Crear Reseña"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación de eliminación */}
      <AlertDialog
        open={!!reviewToDelete}
        onOpenChange={(open) => !open && setReviewToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta reseña?</AlertDialogTitle>
            <AlertDialogDescription>
              La reseña de {reviewToDelete?.customerName} dejará de mostrarse en
              tu tienda. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
