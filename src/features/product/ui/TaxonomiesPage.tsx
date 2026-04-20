import { useState } from "react";
import { Plus, Edit, Trash2, Tag, Layers } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { CategoryIcon } from "@/shared/ui/category-icon";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
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

import { CreateBrandModal } from "@/features/product/ui/CreateBrandModal";
import { CreateCategoryModal } from "@/features/product/ui/CreateCategoryModal";

import {
  useBrands,
  useCategories,
  useDeleteBrand,
  useDeleteCategory,
} from "@/entities/product/api";
import type { Brand, Category } from "@/entities/product/model/types";

type DeleteTarget =
  | { kind: "brand"; id: string; name: string }
  | { kind: "category"; id: string; name: string }
  | null;

export function TaxonomiesPage() {
  const { data: brandsData, isLoading: brandsLoading } = useBrands();
  const { data: categoriesData, isLoading: categoriesLoading } = useCategories();

  const deleteBrand = useDeleteBrand();
  const deleteCategory = useDeleteCategory();

  const brands: Brand[] = (brandsData as unknown as Brand[]) ?? [];
  const categories: Category[] = (categoriesData as unknown as Category[]) ?? [];

  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const openCreateBrand = () => {
    setEditingBrand(null);
    setBrandModalOpen(true);
  };
  const openEditBrand = (brand: Brand) => {
    setEditingBrand(brand);
    setBrandModalOpen(true);
  };
  const openCreateCategory = () => {
    setEditingCategory(null);
    setCategoryModalOpen(true);
  };
  const openEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.kind === "brand") {
        await deleteBrand.mutateAsync(deleteTarget.id);
        toast.success(`Marca "${deleteTarget.name}" eliminada`);
      } else {
        await deleteCategory.mutateAsync(deleteTarget.id);
        toast.success(`Categoría "${deleteTarget.name}" eliminada`);
      }
      setDeleteTarget(null);
    } catch (error) {
      console.error(error);
      toast.error("No se pudo eliminar");
    }
  };

  const isDeleting = deleteBrand.isPending || deleteCategory.isPending;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Layers className="h-6 w-6 text-emerald-500" />
          Marcas y Categorías
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Organiza tu catálogo con las marcas que vendes y las categorías de productos.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CATEGORÍAS */}
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Layers className="h-5 w-5 text-emerald-500" />
                Categorías
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Agrupan productos similares en tu tienda.
              </p>
            </div>
            <Button size="sm" onClick={openCreateCategory}>
              <Plus className="h-4 w-4 mr-1.5" />
              Nueva
            </Button>
          </div>

          {categoriesLoading ? (
            <div className="p-5 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="Aún no tienes categorías"
              description="Crea tu primera categoría para organizar tus productos."
              actionLabel="Crear categoría"
              onAction={openCreateCategory}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[70px]">Icono</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden md:table-cell">Productos</TableHead>
                  <TableHead className="text-right w-[110px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                        <CategoryIcon name={category.icon} size={20} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{category.name}</div>
                      {category.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1 max-w-[260px]">
                          {category.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="secondary">
                        {category.productCount ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditCategory(category)}
                          aria-label="Editar categoría"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            setDeleteTarget({
                              kind: "category",
                              id: category.id,
                              name: category.name,
                            })
                          }
                          aria-label="Eliminar categoría"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* MARCAS */}
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Tag className="h-5 w-5 text-emerald-500" />
                Marcas
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Las empresas o fabricantes de tus productos.
              </p>
            </div>
            <Button size="sm" onClick={openCreateBrand}>
              <Plus className="h-4 w-4 mr-1.5" />
              Nueva
            </Button>
          </div>

          {brandsLoading ? (
            <div className="p-5 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : brands.length === 0 ? (
            <EmptyState
              icon={Tag}
              title="Aún no tienes marcas"
              description="Agrega las marcas con las que trabajas."
              actionLabel="Crear marca"
              onAction={openCreateBrand}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden md:table-cell">Productos</TableHead>
                  <TableHead className="text-right w-[110px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brands.map((brand) => {
                  const productCount = (brand as any).products?.length ?? 0;
                  return (
                    <TableRow key={brand.id}>
                      <TableCell>
                        <div className="font-medium">{brand.name}</div>
                        {brand.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1 max-w-[320px]">
                            {brand.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="secondary">{productCount}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditBrand(brand)}
                            aria-label="Editar marca"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() =>
                              setDeleteTarget({
                                kind: "brand",
                                id: brand.id,
                                name: brand.name,
                              })
                            }
                            aria-label="Eliminar marca"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <CreateBrandModal
        isOpen={brandModalOpen}
        onClose={() => setBrandModalOpen(false)}
        brand={editingBrand}
      />

      <CreateCategoryModal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        category={editingCategory}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Eliminar {deleteTarget?.kind === "brand" ? "marca" : "categoría"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  Se eliminará <span className="font-semibold">"{deleteTarget.name}"</span>. Los
                  productos asociados no se borran pero perderán esta referencia.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="py-12 px-6 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 mb-4">{description}</p>
      <Button size="sm" onClick={onAction}>
        <Plus className="h-4 w-4 mr-1.5" />
        {actionLabel}
      </Button>
    </div>
  );
}
