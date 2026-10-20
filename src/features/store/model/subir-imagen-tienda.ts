import { apiFetch } from "@/shared/api/client";

/**
 * Sube una imagen de la configuración de la tienda (la portada, el banner de
 * una promoción) a su carpeta `<usuario>/stores/`, aparte de las de productos.
 * Queda en WebP; devuelve su URL.
 */
export async function subirImagenDeTienda(archivo: File): Promise<string> {
  const datos = new FormData();
  datos.append("image", archivo);
  const response = await apiFetch<{ url: string; path: string }>("/api/store/upload-image", {
    method: "POST",
    body: datos,
  });
  if (response.data?.url) return response.data.url;
  throw new Error("Error al subir la imagen");
}
