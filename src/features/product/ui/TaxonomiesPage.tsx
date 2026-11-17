import { Fragment, useState } from "react";
import { Plus, Edit, Trash2, Tag, Layers, CornerDownRight, FolderPlus, ChevronRight, Package } from "lucide-react";
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
import { cantidadDeSubcategorias } from "@/entities/product/model/categorias";
import { useAcceso } from "@/app/providers/acceso";
import { PERMISO } from "@/shared/acceso/permisos";

type DeleteTarget =
  | { kind: "brand"; id: string; name: string }
  | { kind: "category"; id: string; name: string; subcategorias: number }
  | null;

export function TaxonomiesPage() {
  // Verlas alcanza para la lista; crear, editar y borrar piden gestionar cada una.
  const { puede } = useAcceso();
  const editaCategorias = puede(PERMISO.GESTIONAR_CATEGORIAS);
  const editaMarcas = puede(PERMISO.GESTIONAR_MARCAS);
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
  const [parentParaNueva, setParentParaNueva] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  // Las principales con subcategorías arrancan plegadas: con varias
  // subcategorías por categoría, la lista desplegada se vuelve interminable.
  const [abiertas, setAbiertas] = useState<Set<string>>(() => new Set());
  const alternar = (id: string) =>
    setAbiertas((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  const idsCategorias = new Set(categories.map((c) => c.id));
  // Una subcategoría se ve solo con su principal abierta (si la principal no
  // vino en la lista, se muestra suelta para no esconderla).
  const visibles = categories.filter(
    (c) => !c.parentId || !idsCategorias.has(c.parentId) || abiertas.has(c.parentId),
  );

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
    setParentParaNueva(null);
    setCategoryModalOpen(true);
  };
  const openCreateSubcategory = (parent: Category) => {
    setEditingCategory(null);
    setParentParaNueva(parent.id);
    // Que la nueva subcategoría se vea al guardarla.
    setAbiertas((actual) => new Set(actual).add(parent.id));
    setCategoryModalOpen(true);
  };
  const openEditCategory = (category: Category) => {
    setEditingCategory(category);
    setParentParaNueva(null);
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
    <div className="space-y-6 w-full">
      <div>
        <h1 className="titulo-pagina">Marcas y categorías</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
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
            {editaCategorias ? (
              <Button size="sm" onClick={openCreateCategory}>
                <Plus className="h-4 w-4 mr-1.5" />
                Nueva
              </Button>
            ) : null}
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
              onAction={editaCategorias ? openCreateCategory : undefined}
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
                {visibles.map((category) => {
                  const esHija = Boolean(category.parentId);
                  const subcategorias = cantidadDeSubcategorias(categories, category.id);
                  const abierta = abiertas.has(category.id);
                  const directos = category.ownProductCount ?? 0;
                  return (
                  <Fragment key={category.id}>
                  <TableRow className={esHija ? "bg-muted/30" : undefined}>
                    <TableCell>
                      {/* La foto si la hay, el icono si no: es la misma regla
                          que aplica la tienda web, y verla acá deja claro qué
                          va a mostrar el cliente. */}
                      <div className={esHija ? "flex items-center gap-1.5 pl-2" : undefined}>
                        {esHija && <CornerDownRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
                        {category.imageUrl ? (
                          <img
                            src={category.imageUrl}
                            alt=""
                            className={esHija ? "h-8 w-8 rounded-lg object-cover" : "h-10 w-10 rounded-lg object-cover"}
                          />
                        ) : (
                          <div
                            className={`flex items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 ${esHija ? "h-8 w-8" : "h-10 w-10"}`}
                          >
                            <CategoryIcon name={category.icon} size={esHija ? 16 : 20} />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {!esHija && subcategorias > 0 ? (
                        <button
                          type="button"
                          onClick={() => alternar(category.id)}
                          aria-expanded={abierta}
                          aria-label={`${abierta ? "Plegar" : "Desplegar"} las subcategorías de ${category.name}`}
                          className="group -my-1 flex items-center gap-1.5 rounded-md py-1 pr-2 text-left"
                        >
                          <ChevronRight
                            aria-hidden
                            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 ${abierta ? "rotate-90" : ""}`}
                          />
                          <span>
                            <span className="block font-medium group-hover:underline underline-offset-4">{category.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {subcategorias} subcategoría{subcategorias === 1 ? "" : "s"}
                            </span>
                          </span>
                        </button>
                      ) : (
                        // Sin flecha, corrido lo mismo que el nombre de las que
                        // la tienen: así todos los nombres arrancan en la misma
                        // línea. Una subcategoría, un escalón más adentro.
                        <div className={esHija ? "pl-[38px]" : "pl-[22px]"}>
                          <div className="font-medium">{category.name}</div>
                          {category.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1 max-w-[260px]">
                              {category.description}
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {/* Una principal cuenta también lo de sus subcategorías:
                          es lo que muestra la tienda al elegirla. */}
                      <div className="flex flex-col items-start gap-0.5">
                        <Badge
                          variant="secondary"
                          title={
                            subcategorias > 0
                              ? `${directos} directamente en ${category.name}, el resto en sus subcategorías`
                              : undefined
                          }
                        >
                          {category.productCount ?? 0}
                        </Badge>
                        {subcategorias > 0 && <span className="text-[11px] text-muted-foreground">en total</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {editaCategorias ? <div className="flex items-center justify-end gap-1">
                        {!esHija && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openCreateSubcategory(category)}
                            aria-label={`Nueva subcategoría dentro de ${category.name}`}
                            title="Nueva subcategoría"
                          >
                            <FolderPlus className="h-4 w-4" />
                          </Button>
                        )}
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
                              subcategorias,
                            })
                          }
                          aria-label="Eliminar categoría"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div> : null}
                    </TableCell>
                  </TableRow>
                  {/* Los productos que están en la principal y en ninguna
                      subcategoría (típicamente, los que ya estaban antes de
                      crearlas). Van como un renglón más de la rama, para que
                      se lea que son de esta categoría y que el total de
                      arriba es la suma. En la tienda aparecen al elegir la
                      principal ("Todo en …"). */}
                  {!esHija && abierta && directos > 0 && (
                    <TableRow className="bg-muted/30" data-testid="sin-subcategoria">
                      <TableCell>
                        <div className="flex items-center gap-1.5 pl-2">
                          <CornerDownRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-dashed border-muted-foreground/40 text-muted-foreground">
                            <Package className="h-4 w-4" aria-hidden />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="pl-[38px]">
                          <div className="font-medium text-muted-foreground">
                            Directo en {category.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Sin subcategoría. En la tienda se ven al elegir {category.name}.
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline">{directos}</Badge>
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  )}
                  </Fragment>
                  );
                })}
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
            {editaMarcas ? (
              <Button size="sm" onClick={openCreateBrand}>
                <Plus className="h-4 w-4 mr-1.5" />
                Nueva
              </Button>
            ) : null}
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
              onAction={editaMarcas ? openCreateBrand : undefined}
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
                        {editaMarcas ? <div className="flex items-center justify-end gap-1">
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
                        </div> : null}
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
        parentIdInicial={parentParaNueva}
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
                  {deleteTarget.kind === "category" && deleteTarget.subcategorias > 0 && (
                    <>
                      {" "}
                      Sus {deleteTarget.subcategorias} subcategoría{deleteTarget.subcategorias === 1 ? "" : "s"} pasan a
                      ser categorías principales, con sus productos.
                    </>
                  )}
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
  /** Sin acción (no puede crear), el vacío no ofrece botón. */
  onAction?: () => void;
}

function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="py-12 px-6 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 mb-4">{description}</p>
      {onAction ? (
        <Button size="sm" onClick={onAction}>
          <Plus className="h-4 w-4 mr-1.5" />
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
