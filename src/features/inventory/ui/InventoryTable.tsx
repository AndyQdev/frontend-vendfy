
import { useRef, useState } from "react";
import { useFiltrosUrl } from "@/shared/hooks/use-filtros-url";
import { useNavigate } from "react-router-dom";
import { useInventory, useMovementsByInventory } from "@/entities/inventory/api";
import { useCategories, useBrands } from "@/entities/product/api";
import { fraseVan, frasesInventario, sonar, useEscaner, useManejadorEscaneo } from "@/features/scanner";
import { decirFrases } from "@/shared/voz";
import { inventariosDeEscaneo } from "../model/escaneo";
import { EmptyState } from "@/shared/ui/empty-state";
import { Truck as TruckIcon, Package as PackageIcon } from "lucide-react";
import { useStore } from "@/app/providers/auth";
import type { Inventory } from "@/entities/inventory/model/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { PaginationControls } from "@/shared/ui/pagination";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/shared/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Search,
  Package,
  Boxes,
  DollarSign,
  AlertTriangle,
  Archive,
  Plus,
  ShoppingCart,
  ArrowUpDown,
  History,
  X,
} from "lucide-react";
import { Switch } from "@/shared/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { CeldasExistencias, ExistenciasEnTarjeta } from "./CeldasExistencias";
import {
  ListaTarjetas,
  SoloEscritorio,
  TarjetaFila,
  FilaTitulo,
  FilaDatos,
  FilaAcciones,
} from "@/shared/ui/lista-tarjetas";
import { MovimientosGlobales } from "./MovimientosGlobales";
import {
  AjusteStockDialog,
  type AlcanceAjuste,
  type AperturaAjuste,
  type DireccionAjuste,
} from "./AjusteStockDialog";
import { formatearCantidad } from "@/entities/inventory/model/envases";
import {
  esSalida,
  MOVEMENT_TYPE_CONFIG,
} from "@/entities/inventory/model/movimientos";
import { useAcceso } from "@/app/providers/acceso";
import { PERMISO } from "@/shared/acceso/permisos";

// Se mudó a entities/inventory/model/envases; se re-exporta para no romper
// importaciones existentes.
export { formatearCantidad };



export default function InventoryTable() {
  const navigate = useNavigate();
  const { puede } = useAcceso();
  const puedeAjustar = puede(PERMISO.GESTIONAR_INVENTARIO);

  // Todo el estado de la lista vive en la dirección: volver, recargar o pasarle
  // el link a alguien deja la misma pantalla.
  const { filtros, borrador, setFiltro, limpiar, hayFiltros } = useFiltrosUrl(
    {
      q: "",
      categoria: "all",
      marca: "all",
      min: "",
      max: "",
      conStock: false,
      vista: "stock",
      pagina: 1,
      tam: 10,
    },
    {
      diferidas: ["q", "min", "max"],
      retraso: 500,
      reiniciar: "pagina",
      ignorar: ["tam", "vista"],
    },
  );
  const searchTerm = borrador.q;
  const debouncedSearch = filtros.q;
  const selectedCategory = filtros.categoria;
  const selectedBrand = filtros.marca;
  const minPriceInput = borrador.min;
  const maxPriceInput = borrador.max;
  const debouncedMinPrice = filtros.min;
  const debouncedMaxPrice = filtros.max;
  const onlyInStock = filtros.conStock;
  const currentPage = filtros.pagina;
  const pageSize = filtros.tam;
  const { selectedStore } = useStore();

  // Categorías y marcas para los selectores
  const storeIdForFilters =
    selectedStore && selectedStore !== "all" ? selectedStore.id : undefined;
  const { data: categoriesData } = useCategories(storeIdForFilters);
  const { data: brandsData } = useBrands();
  const categories = categoriesData || [];
  const brands = brandsData || [];

  // Pestaña activa: el saldo, o el relato de cómo se llegó a él.
  const vista = filtros.vista as "stock" | "movimientos";
  const setVista = (valor: string) => setFiltro("vista", valor);

  // Ajuste en curso. null = diálogo cerrado.
  const [apertura, setApertura] = useState<AperturaAjuste | null>(null);

  // Modal de historial
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyInventoryId, setHistoryInventoryId] = useState<string | null>(null);

  const storeId = selectedStore === "all" ? "all" : (selectedStore?.id || "all");

  // Convertir inputs de precio a número (sólo si son válidos)
  const minPriceNum =
    debouncedMinPrice && !isNaN(Number(debouncedMinPrice))
      ? Number(debouncedMinPrice)
      : undefined;
  const maxPriceNum =
    debouncedMaxPrice && !isNaN(Number(debouncedMaxPrice))
      ? Number(debouncedMaxPrice)
      : undefined;

  const queryParams = {
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
    order: "DESC" as const,
    storeId,
    // Búsqueda multi-campo (nombre, descripción, tags) — más potente que attr/value
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(selectedCategory !== "all" && { categoryId: selectedCategory }),
    ...(selectedBrand !== "all" && { brandId: selectedBrand }),
    ...(minPriceNum !== undefined && { minPrice: minPriceNum }),
    ...(maxPriceNum !== undefined && { maxPrice: maxPriceNum }),
    ...(onlyInStock && { inStock: true }),
  };

  const hasActiveFilters = hayFiltros;
  const handleResetFilters = limpiar;

  const { data: inventoryResponse, isLoading } = useInventory(queryParams);
  const inventories = inventoryResponse?.data || [];
  const totalInventories = inventoryResponse?.countData || 0;
  const totalPages = Math.ceil(totalInventories / pageSize);
  const stats = inventoryResponse?.stats;

  const { data: movementsResponse, isLoading: isLoadingMovements } =
    useMovementsByInventory(historyInventoryId);

  // El retraso del buscador y la vuelta a la primera página los maneja
  // `useFiltrosUrl`; acá ya no hace falta ningún efecto.
  const handlePageChange = (page: number) => setFiltro("pagina", page);
  const handlePageSizeChange = (newPageSize: number) => setFiltro("tam", newPageSize);

  const abrirAjuste = (
    inventory: Inventory,
    alcance: AlcanceAjuste,
    direccion: DireccionAjuste,
  ) => setApertura({ inventory, alcance, direccion });

  const openHistoryDialog = (inventoryId: string) => {
    setHistoryInventoryId(inventoryId);
    setHistoryDialogOpen(true);
  };

  // ─── Escáner ───────────────────────────────────────────────────────────
  // Acá una lectura abre el ajuste de stock de ese producto, con el producto
  // arriba: agregar, quitar o contar. Escanear el mismo otra vez suma uno.
  // Si no está registrado, la hoja de siempre para darlo de alta (con lo que
  // hay como stock inicial).
  const { buscar, abrir: abrirHojaEscaneo } = useEscaner();
  const aperturaRef = useRef(apertura);
  aperturaRef.current = apertura;

  useManejadorEscaneo(async (lectura) => {
    const r = await buscar(lectura.codigo);
    if (!r.producto) {
      abrirHojaEscaneo(lectura.codigo, { resultado: r, contexto: "inventario" });
      return true;
    }
    const tiendas = inventariosDeEscaneo(r, storeId);
    // Registrado, pero no en esta tienda: la hoja de siempre lo explica.
    if (tiendas.length === 0) return false;
    sonar("encontrado");
    const actual = aperturaRef.current;
    if (actual?.escaneo && tiendas.some((t) => t.id === actual.inventory.id)) {
      // Escanear otra vez el mismo es contar uno más: "Van dos."
      decirFrases([fraseVan(actual.escaneo.lecturas + 1)]);
      setApertura({ ...actual, escaneo: { ...actual.escaneo, lecturas: actual.escaneo.lecturas + 1 } });
      return true;
    }
    setHistoryDialogOpen(false);
    // "Mermelada Arcor. Tienes cuatro. ¿Agregas, quitas o cuentas?"
    decirFrases(frasesInventario(r, storeId === "all" ? null : storeId));
    setApertura({
      inventory: tiendas[0],
      alcance: "envase",
      direccion: "in",
      escaneo: { lecturas: 1, tiendas },
    });
    return true;
  }, true, "Abre su stock: agregar, quitar o contar");


  const getStatusBadge = (status: string) => {
    switch (status) {
      case "disponible":
        return <Badge className="bg-green-500">Disponible</Badge>;
      case "agotado":
        return <Badge variant="destructive">Agotado</Badge>;
      case "reservado":
        return <Badge className="bg-yellow-500">Reservado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };


  return (
    <div className="space-y-6">
      <Tabs
        value={vista}
        onValueChange={(v) => setVista(v as "stock" | "movimientos")}
      >
        <TabsList>
          <TabsTrigger value="stock" className="gap-1.5">
            <Boxes className="h-4 w-4" />
            Stock
          </TabsTrigger>
          <TabsTrigger value="movimientos" className="gap-1.5">
            <History className="h-4 w-4" />
            Movimientos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-4 space-y-6">
        {/* Stats Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-card border rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-lg animate-pulse w-10 h-10" />
                  <div className="flex-1">
                    <div className="h-3 bg-muted rounded w-24 animate-pulse mb-2" />
                    <div className="h-6 bg-muted rounded w-16 animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <Archive className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Productos Únicos</p>
                  <p className="text-2xl font-semibold">{stats.uniqueProducts}</p>
                </div>
              </div>
            </div>

            <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <Boxes className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Unidades en Stock</p>
                  <p className="text-2xl font-semibold">{stats.totalUnits}</p>
                </div>
              </div>
            </div>

            <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg">
                  <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="text-2xl font-semibold">
                    Bs. {stats.totalValue.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Productos Agotados</p>
                  <p className="text-2xl font-semibold">{stats.outOfStock}</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Filtros: una sola fila desde laptop; apilados en pantallas chicas. */}
        <div className="bg-card border rounded-lg p-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          {/* Búsqueda */}
          <div className="relative lg:min-w-[220px] lg:flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar o escanear un producto..."
              value={searchTerm}
              onChange={(e) => setFiltro("q", e.target.value)}
              className="pl-10 pr-9"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setFiltro("q", "")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Fila de filtros */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Categoría */}
            <div className="min-w-0 flex-1 sm:flex-none sm:w-40">
              <Select value={selectedCategory} onValueChange={(v) => setFiltro("categoria", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.fullName || cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Marca */}
            <div className="min-w-0 flex-1 sm:flex-none sm:w-40">
              <Select value={selectedBrand} onValueChange={(v) => setFiltro("marca", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Marca" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las marcas</SelectItem>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Rango de precio */}
            <div className="flex items-center gap-1.5 px-2.5 h-10 max-md:h-11 rounded-md border bg-background">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={minPriceInput}
                onChange={(e) => setFiltro("min", e.target.value)}
                placeholder="Min"
                className="w-14 h-8 max-md:h-9 px-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 md:text-sm"
              />
              <span className="text-muted-foreground text-sm">–</span>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={maxPriceInput}
                onChange={(e) => setFiltro("max", e.target.value)}
                placeholder="Max"
                className="w-14 h-8 max-md:h-9 px-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 md:text-sm"
              />
            </div>

            {/* Solo con stock */}
            <div className="flex items-center gap-2 px-3 h-10 rounded-md border bg-background">
              <Boxes className="h-3.5 w-3.5 text-muted-foreground" />
              <label
                htmlFor="inv-instock"
                className="text-sm whitespace-nowrap cursor-pointer select-none"
              >
                Con stock
              </label>
              <Switch
                id="inv-instock"
                checked={onlyInStock}
                onCheckedChange={(v) => setFiltro("conStock", v)}
              />
            </div>

            {/* Reset */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-10 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Limpiar</span>
              </Button>
            )}
          </div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <>
          <SoloEscritorio className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Imagen</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Tienda</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead className="text-center">Consumo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(pageSize)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="w-16 h-16 bg-muted rounded-lg animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 bg-muted rounded w-32 animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 bg-muted rounded w-20 animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 bg-muted rounded w-24 animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 bg-muted rounded w-16 animate-pulse ml-auto" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 bg-muted rounded w-12 animate-pulse ml-auto" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 bg-muted rounded w-12 animate-pulse ml-auto" />
                    </TableCell>
                    <TableCell>
                      <div className="h-6 bg-muted rounded w-20 animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-8 bg-muted rounded w-24 animate-pulse mx-auto" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SoloEscritorio>

          <ListaTarjetas>
            {[...Array(4)].map((_, i) => (
              <TarjetaFila key={i}>
                <FilaTitulo
                  medio={<div className="h-14 w-14 shrink-0 animate-pulse rounded-lg bg-muted" />}
                  titulo={<div className="h-4 w-32 animate-pulse rounded bg-muted" />}
                  subtitulo={<div className="mt-1 h-3 w-20 animate-pulse rounded bg-muted" />}
                />
                <div className="h-7 w-24 animate-pulse rounded-lg bg-muted" />
              </TarjetaFila>
            ))}
          </ListaTarjetas>
          </>
        ) : inventories.length === 0 ? (
          hasActiveFilters ? (
            <EmptyState
              icon={PackageIcon}
              title="No encontramos resultados"
              description="No hay productos que coincidan con los filtros aplicados. Prueba ajustando los criterios."
              primaryAction={{
                label: "Limpiar filtros",
                variant: "outline",
                onClick: handleResetFilters,
              }}
            />
          ) : (
            <EmptyState
              icon={PackageIcon}
              title="Tu inventario está vacío"
              description="Cuando crees productos y registres compras, aparecerán aquí con su stock disponible. La forma correcta de cargar stock es desde Compras — así queda registrado en tus reportes."
              primaryAction={puede(PERMISO.GESTIONAR_PRODUCTOS) ? {
                label: "Crear producto",
                icon: Plus,
                onClick: () => navigate("/products/create"),
              } : undefined}
              secondaryAction={puedeAjustar ? {
                label: "Registrar compra",
                icon: TruckIcon,
                variant: "outline",
                onClick: () => navigate("/purchases/new"),
              } : undefined}
            />
          )
        ) : (
          <div className="rounded-lg md:border">
            <SoloEscritorio>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Imagen</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Tienda</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead className="text-center">Consumo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventories.map((inventory) => (
                  <TableRow key={inventory.id}>
                    <TableCell>
                      <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden">
                        {inventory.product.imageUrls &&
                        inventory.product.imageUrls.length > 0 ? (
                          <img
                            src={inventory.product.imageUrls[0]}
                            alt={inventory.product.name}
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
                        <p className="font-medium">{inventory.product.name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {inventory.product.sku ? (
                        <Badge variant="outline" className="font-mono text-xs">
                          {inventory.product.sku}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          Sin código
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{inventory.store.name}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold text-green-600">
                        Bs. {inventory.product.price?.toFixed(2) || "0.00"}
                      </span>
                    </TableCell>
                    <CeldasExistencias
                      inventory={inventory}
                      onAjustar={(alcance, direccion) =>
                        abrirAjuste(inventory, alcance, direccion)
                      }
                    />
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        {getStatusBadge(inventory.status)}
                        {inventory.reservedQuantity > 0 && (
                          <span className="text-[10px] text-yellow-600 dark:text-yellow-500">
                            {formatearCantidad(
                              inventory.reservedQuantity,
                              inventory.product?.baseUnit
                            )}{" "}
                            reservado
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        {puedeAjustar ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Registrar compra"
                              onClick={() => abrirAjuste(inventory, "envase", "in")}
                            >
                              <ShoppingCart className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Ajustar stock"
                              onClick={() => abrirAjuste(inventory, "envase", "out")}
                            >
                              <ArrowUpDown className="h-4 w-4 text-orange-600" />
                            </Button>
                          </>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Ver historial"
                          onClick={() => openHistoryDialog(inventory.id)}
                        >
                          <History className="h-4 w-4 text-gray-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </SoloEscritorio>

            {/* Nueve columnas no caben en 360 px. Lo que no se negocia es el
                control de -/+: ajustar stock es para lo que se entra acá. */}
            <ListaTarjetas className="pb-2">
              {inventories.map((inventory) => (
                <TarjetaFila
                  key={inventory.id}
                  acciones={
                    <FilaAcciones>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openHistoryDialog(inventory.id)}
                      >
                        <History className="mr-1 h-4 w-4 text-gray-600" />
                        Historial
                      </Button>
                    </FilaAcciones>
                  }
                >
                  <FilaTitulo
                    medio={
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {inventory.product.imageUrls &&
                        inventory.product.imageUrls.length > 0 ? (
                          <img
                            src={inventory.product.imageUrls[0]}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    }
                    titulo={inventory.product.name}
                    subtitulo={inventory.product.sku || "Sin código"}
                    derecha={
                      <>
                        <div className="text-sm font-semibold text-green-600">
                          Bs. {inventory.product.price?.toFixed(2) || "0.00"}
                        </div>
                        <div className="mt-1">{getStatusBadge(inventory.status)}</div>
                      </>
                    }
                  />

                  <ExistenciasEnTarjeta
                    inventory={inventory}
                    onAjustar={(alcance, direccion) =>
                      abrirAjuste(inventory, alcance, direccion)
                    }
                  />

                  <FilaDatos
                    datos={[
                      { etiqueta: "Tienda", valor: inventory.store.name },
                      ...(inventory.reservedQuantity > 0
                        ? [
                            {
                              etiqueta: "Reservado",
                              valor: formatearCantidad(
                                inventory.reservedQuantity,
                                inventory.product?.baseUnit,
                              ),
                            },
                          ]
                        : []),
                    ]}
                  />
                </TarjetaFila>
              ))}
            </ListaTarjetas>

            {!isLoading && inventories.length > 0 && (
              <div className="border-t p-4">
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={totalInventories}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                  pageSizeOptions={[5, 10, 20, 50]}
                />
              </div>
            )}
          </div>
        )}
        </TabsContent>

        <TabsContent value="movimientos" className="mt-4">
          <MovimientosGlobales storeId={storeId} />
        </TabsContent>
      </Tabs>


      {/* Dialog: Historial de Movimientos */}
      <ResponsiveDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
      >
        <ResponsiveDialogContent className="sm:max-w-[640px]">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Historial de movimientos</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Últimos movimientos registrados para este producto
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <ResponsiveDialogBody className="pb-6">

          {isLoadingMovements ? (
            <div className="space-y-3 py-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-muted rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : !movementsResponse?.data?.length ? (
            <div className="text-center py-8">
              <History className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                No hay movimientos registrados
              </p>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {movementsResponse.data.map((movement) => {
                const config = MOVEMENT_TYPE_CONFIG[movement.type];
                const salida = esSalida(movement.type, movement.direction);
                return (
                <div
                  key={movement.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                        config?.chip ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {config?.icon}
                      {config?.label ?? movement.type}
                    </span>
                    <div>
                      <p className="text-sm font-medium tabular-nums">
                        {movement.direction === 0 ? "" : salida ? "−" : "+"}
                        {formatearCantidad(
                          movement.quantity,
                          movement.inventory?.product?.baseUnit
                        )}
                      </p>
                      {movement.notes && (
                        <p className="text-xs text-muted-foreground">
                          {movement.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {movement.totalCost && (
                      <p className="text-sm font-medium">
                        Bs. {Number(movement.totalCost).toFixed(2)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(movement.created_at).toLocaleDateString(
                        "es-BO",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </p>
                  </div>
                </div>
                );
              })}
            </div>
          )}
          </ResponsiveDialogBody>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <AjusteStockDialog
        apertura={apertura}
        onClose={() => setApertura(null)}
        onHistorial={(inv) => {
          setApertura(null);
          openHistoryDialog(inv.id);
        }}
        onEditar={(inv) => {
          setApertura(null);
          navigate(`/products/${inv.product.id}`);
        }}
        onCambiarTienda={(inv) => setApertura((a) => (a ? { ...a, inventory: inv } : a))}
      />
    </div>
  );
}
