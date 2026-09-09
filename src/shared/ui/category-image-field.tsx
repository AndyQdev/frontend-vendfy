import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/shared/api/client";
import { cn } from "@/shared/lib/cn";

/**
 * La foto de una categoría.
 *
 * Sube al mismo bucket que las fotos de producto —reutiliza
 * `/api/product/upload-image`, que ya existe y ya valida el archivo— y
 * devuelve la URL pública. Un campo aparte para categorías habría duplicado
 * el endpoint sin ganar nada.
 *
 * Cadena vacía al quitarla, no `null`: es lo que el backend interpreta como
 * "volver al icono".
 */
export function CategoryImageField({
  value,
  onChange,
  className,
}: {
  value?: string | null;
  onChange: (url: string | null) => void;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  const subir = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Ese archivo no es una imagen");
      return;
    }
    // 5 MB: una foto de vitrina no necesita más, y el límite evita que un
    // arrastre accidental de un RAW cuelgue la subida.
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no puede pesar más de 5 MB");
      return;
    }

    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const response = await apiFetch<{ url: string }>("/api/product/upload-image", {
        method: "POST",
        body: formData,
      });
      if (!response.data?.url) throw new Error("Sin URL");
      onChange(response.data.url);
    } catch {
      toast.error("No se pudo subir la imagen");
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void subir(file);
        }}
      />

      {value ? (
        <div className="relative h-32 w-full overflow-hidden rounded-lg border bg-muted">
          <img src={value} alt="Foto de la categoría" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Quitar la foto"
            className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 text-muted-foreground shadow-sm transition-colors hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={subiendo}
            className="absolute bottom-2 right-2 rounded-md bg-background/90 px-2.5 py-1 text-xs font-medium shadow-sm hover:bg-background"
          >
            {subiendo ? "Subiendo…" : "Cambiar"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={subiendo}
          className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-60"
        >
          {subiendo ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <ImagePlus className="h-6 w-6" />
          )}
          <span className="text-xs">
            {subiendo ? "Subiendo…" : "Subir una foto"}
          </span>
        </button>
      )}
    </div>
  );
}
