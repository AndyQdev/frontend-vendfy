import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
  sku: z.string().optional(),
  /** Código de barras tal como se leyó; el backend lo normaliza. */
  barcode: z.string().max(60).optional(),
  brandId: z.string().optional(),
  /** Marca por nombre (alta desde el escáner): se reutiliza o se crea. */
  brandName: z.string().max(100).optional(),
  /** Categoría por nombre (la que sugiere la IA): se reutiliza o se crea. */
  categoryName: z.string().max(100).optional(),
  categoryId: z.string().optional(),
  storeId: z.string().min(1, "El store es requerido"),
  price: z.number().positive("El precio debe ser mayor a 0"),
  initialStock: z.number().min(0, "El stock no puede ser negativo").optional(),
  metadata: z.object({
    isFeatured: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    specifications: z.record(z.string()).optional()
  }).optional()
});

export type ProductInput = z.infer<typeof productSchema>;
