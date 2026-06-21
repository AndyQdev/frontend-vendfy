import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useProducts, useCategories, useBrands, useDeleteProduct } from "@/entities/product/api";
import { useStore } from "@/app/providers/auth";
import { EmptyState } from "@/shared/ui/empty-state";
import { Tag, Boxes, Barcode, ShoppingCart as CartIcon, Copy } from "lucide-react";
import type { Product } from "@/entities/product/model/types";
import { ButtonMagic } from "@/shared/ui/button-magic";
import { AiGenerateModal } from "./AiGenerateModal";
import { CopyProductModal } from "./CopyProductModal";
import { Sparkles } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { PaginationControls } from "@/shared/ui/pagination";
import { 
  Search, 
  Plus, 
  Package, 
  Edit, 
  Trash2, 
  MoreHorizontal,
  Grid3x3,
  List,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";

export function ProductsDataTable() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isWelcome = searchParams.get("welcome") === "1";
  const { selectedStore } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1); // Cambiado a base 1
  const [pageSize, setPageSize] = useState(10); // Ahora es mutable
  const [currentImageIndexes, setCurrentImageIndexes] = useState<Record<string, number>>({});
  const [copyingProduct, setCopyingProduct] = useState<Product | null>(null);

  // ID de la tienda activa (o "all" si está en modo todas las tiendas)
  const activeStoreId =
    selectedStore && selectedStore !== "all" ? selectedStore.id : "all";
  const isSingleStoreView = activeStoreId !== "all";

  // Query params para el backend (convertir a base 0 para offset)
  const queryParams = {
    limit: pageSize,
    offset: (currentPage - 1) * pageSize, // Convertir de base 1 a offset
    order: "DESC" as const,
    storeId: activeStoreId,
    ...(searchTerm && { attr: "name", value: searchTerm }),
    ...(selectedCategory && selectedCategory !== "all" && { categoryId: selectedCategory }),
    ...(selectedBrand && selectedBrand !== "all" && { brandId: selectedBrand }),
  };

  const { data: productsResponse, isLoading: productsLoading } = useProducts(queryParams);
  const { data: categoriesResponse, isLoading: categoriesLoading } = useCategories();
  const { data: brandsResponse, isLoading: brandsLoading } = useBrands();
  const deleteProduct = useDeleteProduct();

  const products = productsResponse?.data || [];
  const totalProducts = productsResponse?.countData || 0;
  const categories:any = categoriesResponse || [];
  const brands:any = brandsResponse || [];

  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1); // Reset to first page (base 1)
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar el producto "${name}"?`)) {
      try {
        await deleteProduct.mutateAsync(id);
        toast.success("Producto eliminado correctamente");
      } catch (error) {
        toast.error("Error al eliminar el producto");
      }
    }
  };

  const handleCategoryFilter = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1);
  };

  const handleBrandFilter = (brandId: string) => {
    setSelectedBrand(brandId);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset a primera página al cambiar el tamaño
  };

  // Image carousel
  const handleNextImage = (productId: string, imageUrls: string[]) => {
    setCurrentImageIndexes(prev => {
      const currentIndex = prev[productId] || 0;
      const newIndex = currentIndex < imageUrls.length - 1 ? currentIndex + 1 : 0;
      return { ...prev, [productId]: newIndex };
    });
  };

  const handlePreviousImage = (productId: string, imageUrls: string[]) => {
    setCurrentImageIndexes(prev => {
      const currentIndex = prev[productId] || 0;
      const newIndex = currentIndex > 0 ? currentIndex - 1 : imageUrls.length - 1;
      return { ...prev, [productId]: newIndex };
    });
  };

  const getCurrentImageIndex = (productId: string) => {
    return currentImageIndexes[productId] || 0;
  };

  const totalPages = Math.ceil(totalProducts / pageSize);

  // Renderiza el precio según el modo (tienda única vs todas las tiendas)
  const renderPrice = (product: Product) => {
    // Modo tienda única: el backend devuelve `price` plano
    if (isSingleStoreView) {
      const price = typeof product.price === "number"
        ? product.price
        : product.storeProducts?.[0]?.price ?? 0;
      return (
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          Bs. {price.toFixed(2)}
        </span>
      );
    }

    // Modo "todas las tiendas": mostrar rango si hay varios precios distintos
    const prices = (product.storeProducts ?? []).map((sp) => sp.price);
    if (prices.length === 0) {
      return <span className="text-muted-foreground text-xs">Sin precio</span>;
    }
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) {
      return (
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          Bs. {min.toFixed(2)}
        </span>
      );
    }
    return (
      <div className="flex flex-col items-end">
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          Bs. {min.toFixed(2)} – {max.toFixed(2)}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {prices.length} tiendas
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Productos</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tu catálogo de productos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ButtonMagic onClick={() => setAiModalOpen(true)} alwaysActive>
            <Sparkles className="h-4 w-4" />
            Crear con IA
          </ButtonMagic>
          <Button onClick={() => navigate("/products/create")}>
            <Plus className="mr-2 h-4 w-4" />
            Crear Producto
          </Button>
        </div>
      </div>

      {/* Stats Cards - Para Inventario */}
      {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Productos</p>
              <p className="text-xl font-semibold">{totalProducts}</p>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <Package className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Stock Bajo</p>
              <p className="text-xl font-semibold">0</p>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <Package className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valor Total</p>
              <p className="text-xl font-semibold">Bs. 0.00</p>
            </div>
          </div>
        </div>
      </div> */}

      {/* Filters */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar productos por nombre o SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="w-full lg:w-48">
            <Select value={selectedCategory} onValueChange={handleCategoryFilter} disabled={categoriesLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Brand Filter */}
          <div className="w-full lg:w-48">
            <Select value={selectedBrand} onValueChange={handleBrandFilter} disabled={brandsLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las marcas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las marcas</SelectItem>
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("grid")}
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Products Content Area with Loading State */}
      {productsLoading ? (
        /* Skeleton Loader */
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(pageSize)].map((_, i) => (
              <div key={i} className="bg-card border rounded-lg overflow-hidden">
                <div className="aspect-square bg-muted animate-pulse" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
                  <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
                  <div className="flex gap-2 mt-4">
                    <div className="h-8 bg-muted rounded flex-1 animate-pulse" />
                    <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Imagen</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[80px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(pageSize)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="w-16 h-16 bg-muted rounded-lg animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <div className="h-4 bg-muted rounded w-32 animate-pulse" />
                        <div className="h-3 bg-muted rounded w-48 animate-pulse" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="h-6 bg-muted rounded w-20 animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 bg-muted rounded w-24 animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 bg-muted rounded w-20 animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 bg-muted rounded w-20 animate-pulse ml-auto" />
                    </TableCell>
                    <TableCell>
                      <div className="h-6 bg-muted rounded w-16 animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-8 w-8 bg-muted rounded animate-pulse mx-auto" />
                    </TableCell>
                    <TableCell>
                      <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      ) : products.length === 0 ? (
        searchTerm || selectedCategory !== "all" || selectedBrand !== "all" ? (
          <EmptyState
            icon={Package}
            title="No encontramos productos"
            description="Prueba con otro término o quita los filtros aplicados."
            primaryAction={{
              label: "Limpiar filtros",
              variant: "outline",
              onClick: () => {
                setSearchTerm("");
                setSelectedCategory("all");
                setSelectedBrand("all");
              },
            }}
          />
        ) : isWelcome ? (
          <EmptyState
            variant="welcome"
            badge="🎉 ¡Tu tienda está lista!"
            icon={Package}
            title="Agreguemos tu primer producto"
            description={
              <>
                Esto es lo que vas a vender en tu <span className="font-medium">caja</span> y en tu{" "}
                <span className="font-medium">tienda online</span>. Toma menos de 2 minutos.
              </>
            }
            primaryAction={{
              label: "Crear mi primer producto",
              icon: Plus,
              onClick: () => navigate("/products/create"),
            }}
            secondaryAction={{
              label: "Crear con IA",
              icon: Sparkles,
              variant: "outline",
              onClick: () => setAiModalOpen(true),
            }}
            faqs={[
              {
                icon: Barcode,
                title: "¿Qué es el SKU?",
                body: "Es el código único del producto. Si tienes lector de barras, escanéalo. Si no, puedes inventarlo (ej: CAMI-001).",
              },
              {
                icon: Tag,
                title: "Etiquetas y categorías",
                body: "Ayudan a tus clientes a encontrar el producto cuando buscan en tu tienda online. Mientras más relevantes, mejor.",
              },
              {
                icon: Boxes,
                title: "Stock e inventario",
                body: "Cada producto se enlaza a tu inventario. Para recargar stock más adelante, usa la sección Compras.",
              },
            ]}
          />
        ) : (
          <EmptyState
            icon={Package}
            title="Aún no tienes productos"
            description="Crea tu primer producto para empezar a venderlo en caja y en tu tienda online."
            primaryAction={{
              label: "Crear producto",
              icon: Plus,
              onClick: () => navigate("/products/create"),
            }}
            secondaryAction={{
              label: "Crear con IA",
              icon: Sparkles,
              variant: "outline",
              onClick: () => setAiModalOpen(true),
            }}
          />
        )
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-card border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Product Image Carousel */}
              <div className="aspect-square bg-muted relative group">
                {product.imageUrls && product.imageUrls.length > 0 ? (
                  <>
                    <img
                      src={product.imageUrls[getCurrentImageIndex(product.id)]}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Carousel Controls */}
                    {product.imageUrls.length > 1 && (
                      <>
                        <button
                          onClick={() => handlePreviousImage(product.id, product.imageUrls!)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleNextImage(product.id, product.imageUrls!)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                        
                        {/* Dots */}
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                          {product.imageUrls.map((_, idx) => (
                            <div
                              key={idx}
                              className={`w-1.5 h-1.5 rounded-full ${
                                idx === getCurrentImageIndex(product.id)
                                  ? "bg-white"
                                  : "bg-white/50"
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}

                {/* Featured Badge */}
                {product.metadata?.isFeatured && (
                  <Badge className="absolute top-2 right-2">
                    Destacado
                  </Badge>
                )}
              </div>

              {/* Product Info */}
              <div className="p-4">
                <h3 className="font-medium mb-1 truncate">{product.name}</h3>
                {product.sku && (
                  <p className="text-xs text-muted-foreground mb-2">SKU: {product.sku}</p>
                )}
                {product.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {product.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">
                    {product.category?.name || "Sin categoría"}
                  </span>
                  <span className="text-muted-foreground">
                    {product.brand?.name || "Sin marca"}
                  </span>
                </div>

                <div className="mb-3">
                  {renderPrice(product)}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => navigate(`/products/${product.id}`)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(product.id, product.name)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Imagen</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[60px] text-center">Copiar</TableHead>
                <TableHead className="w-[80px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden">
                      {product.imageUrls && product.imageUrls.length > 0 ? (
                        <img
                          src={product.imageUrls[0]}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      {product.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {product.sku ? (
                      <Badge variant="outline" className="font-mono text-xs">
                        {product.sku}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">Sin SKU</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {product.category?.name || (
                        <span className="text-muted-foreground">Sin categoría</span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {product.brand?.name || (
                        <span className="text-muted-foreground">Sin marca</span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {renderPrice(product)}
                  </TableCell>
                  <TableCell>
                    {product.metadata?.isFeatured ? (
                      <Badge>Destacado</Badge>
                    ) : (
                      <Badge variant="secondary">Normal</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Duplicar producto"
                      onClick={() => setCopyingProduct(product)}
                      className="hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-600 dark:hover:text-emerald-400"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/products/${product.id}`)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(product.id, product.name)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination pegada al table */}
          {!productsLoading && products.length > 0 && (
            <div className="border-t p-4">
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={totalProducts}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                pageSizeOptions={[5, 10, 20, 50]}
              />
            </div>
          )}
        </div>
      )}

      {/* Pagination para Grid View */}
      {viewMode === "grid" && !productsLoading && products.length > 0 && (
        <div className="p-4 bg-card border rounded-lg">
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalProducts}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            pageSizeOptions={[5, 10, 20, 50]}
          />
        </div>
      )}

      {/* AI Generate Modal */}
      <AiGenerateModal open={aiModalOpen} onOpenChange={setAiModalOpen} />

      {/* Copy Product Modal */}
      <CopyProductModal
        isOpen={!!copyingProduct}
        onClose={() => setCopyingProduct(null)}
        sourceProduct={copyingProduct}
      />
    </div>
  );
}
