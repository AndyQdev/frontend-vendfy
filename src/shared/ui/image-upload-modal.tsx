import { useState, useRef } from "react";
import { X, Upload, GripVertical } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { apiFetch } from "@/shared/api/client";

interface ImageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
}

// Map para guardar la relación URL -> path de Supabase
const imagePathMap = new Map<string, string>();

export function ImageUploadModal({
  isOpen,
  onClose,
  images,
  onImagesChange,
  maxImages = 10
}: ImageUploadModalProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const uploadImageToServer = async (file: File): Promise<{ url: string; path: string }> => {
    const formData = new FormData();
    formData.append("image", file);

    const response = await apiFetch<{ url: string; path: string }>("/api/product/upload-image", {
      method: "POST",
      body: formData
    });

    if (response.data?.url && response.data?.path) {
      return { url: response.data.url, path: response.data.path };
    }

    throw new Error("Error al subir la imagen");
  };

  const deleteImageFromServer = async (url: string) => {
    const path = imagePathMap.get(url);
    if (!path) {
      console.warn("No se encontró el path para la imagen:", url);
      return;
    }

    try {
      await apiFetch("/api/product/delete-image", {
        method: "POST",
        body: { path }
      });

      // Eliminar del map
      imagePathMap.delete(url);
    } catch (error) {
      console.error("Error al eliminar imagen del servidor:", error);
      throw error;
    }
  };

  const handleAddImageUrl = () => {
    if (newImageUrl.trim() && images.length < maxImages) {
      onImagesChange([...images, newImageUrl.trim()]);
      setNewImageUrl("");
    }
  };

  const handleRemoveImage = async (index: number) => {
    const imageUrl = images[index];
    
    setDeletingIndex(index);
    
    // Si la imagen está en el map (subida a Supabase), eliminarla del servidor
    if (imagePathMap.has(imageUrl)) {
      try {
        await deleteImageFromServer(imageUrl);
      } catch (error) {
        console.error("Error al eliminar del servidor:", error);
        // Continuar con la eliminación del frontend aunque falle el servidor
      }
    }
    
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
    setDeletingIndex(null);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedIndex === null) return;

    const newImages = [...images];
    const draggedImage = newImages[draggedIndex];

    newImages.splice(draggedIndex, 1);
    const adjustedDropIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
    newImages.splice(adjustedDropIndex, 0, draggedImage);

    onImagesChange(newImages);
    setDraggedIndex(null);
  };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    const availableSlots = maxImages - images.length;
    const filesToUpload = fileArray.slice(0, availableSlots);

    if (filesToUpload.length === 0) return;

    setUploading(true);
    const uploadedUrls: string[] = [];

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        setUploadProgress(prev => [...prev, `Subiendo ${file.name}...`]);

        try {
          const { url, path } = await uploadImageToServer(file);
          
          // Guardar la relación URL -> path
          imagePathMap.set(url, path);
          uploadedUrls.push(url);

          setUploadProgress(prev =>
            prev.map((item, index) =>
              index === i ? `✓ ${file.name} subido` : item
            )
          );
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          setUploadProgress(prev =>
            prev.map((item, index) =>
              index === i ? `✗ Error al subir ${file.name}` : item
            )
          );
        }
      }

      if (uploadedUrls.length > 0) {
        onImagesChange([...images, ...uploadedUrls]);
      }
    } finally {
      setUploading(false);
      setTimeout(() => {
        setUploadProgress([]);
      }, 2000);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />

      <div className="relative bg-background rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-semibold">Gestionar Imágenes</h2>
            <p className="text-sm text-muted-foreground">
              {images.length} de {maxImages} imágenes
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Upload Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Subir desde tu dispositivo</label>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                disabled={uploading || images.length >= maxImages}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || images.length >= maxImages}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? "Subiendo..." : "Seleccionar archivos"}
              </Button>
            </div>

            {uploadProgress.length > 0 && (
              <div className="mt-3 space-y-1">
                {uploadProgress.map((status, index) => (
                  <p key={index} className="text-sm text-muted-foreground">
                    {status}
                  </p>
                ))}
              </div>
            )}

            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">O agregar URL de imagen</label>
              <div className="flex gap-2">
                <Input
                  type="url"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="https://ejemplo.com/imagen.jpg"
                  disabled={images.length >= maxImages}
                />
                <Button
                  type="button"
                  onClick={handleAddImageUrl}
                  disabled={!newImageUrl.trim() || images.length >= maxImages}
                >
                  Agregar
                </Button>
              </div>
            </div>
          </div>

          {/* Images Grid */}
          <div>
            <label className="block text-sm font-medium mb-3">
              Imágenes cargadas {images.length > 0 && "(Arrastra para reordenar)"}
            </label>
            {images.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay imágenes cargadas</p>
                <p className="text-sm text-muted-foreground">
                  Sube archivos o agrega URLs para comenzar
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((url, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`relative group rounded-lg overflow-hidden border-2 transition-all cursor-move ${
                      draggedIndex === index
                        ? "opacity-50 scale-95"
                        : "hover:border-primary"
                    }`}
                  >
                    <div className="aspect-square">
                      <img
                        src={url}
                        alt={`Product ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    {/* Badge de orden */}
                    <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded-full">
                      {index + 1}
                    </div>

                    {/* Drag handle */}
                    <div className="absolute top-2 right-2 bg-background/80 p-1 rounded transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
                      <GripVertical className="h-4 w-4" />
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => handleRemoveImage(index)}
                      disabled={deletingIndex === index}
                      className="absolute bottom-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full transition-opacity disabled:opacity-50 disabled:cursor-not-allowed [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                    >
                      {deletingIndex === index ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-4 p-6 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={onClose}>
            Guardar ({images.length})
          </Button>
        </div>
      </div>
    </div>
  );
}
