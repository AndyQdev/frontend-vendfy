import type { Category } from "./types";

/**
 * Subcategorías: dos niveles como máximo (Accesorios › Cargadores). El backend
 * lo sostiene; esto es cómo se muestran en el panel.
 */

/** El nombre para mostrar: la ruta si es subcategoría. */
export function etiquetaCategoria(c: Pick<Category, "name" | "fullName">): string {
  return c.fullName || c.name;
}

export function esSubcategoria(c: Pick<Category, "parentId">): boolean {
  return Boolean(c.parentId);
}

/**
 * Cada principal seguida de sus subcategorías, las dos en orden alfabético.
 * Es el orden en que se leen: en un selector, "Cargadores" aparece justo
 * debajo de "Accesorios" y no perdido entre las demás. Una subcategoría cuya
 * principal no vino (borrada, o fuera de la página) queda como principal.
 */
export function ordenarEnArbol<T extends Category>(categorias: T[]): T[] {
  const porNombre = (a: T, b: T) => a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  const ids = new Set(categorias.map((c) => c.id));
  const principales = categorias.filter((c) => !c.parentId || !ids.has(c.parentId)).sort(porNombre);
  const hijas = new Map<string, T[]>();
  for (const c of categorias) {
    if (c.parentId && ids.has(c.parentId)) hijas.set(c.parentId, [...(hijas.get(c.parentId) ?? []), c]);
  }
  return principales.flatMap((p) => [p, ...(hijas.get(p.id) ?? []).sort(porNombre)]);
}

export function cantidadDeSubcategorias(categorias: Category[], id: string): number {
  return categorias.filter((c) => c.parentId === id).length;
}
