
import { useState, useEffect } from "react";
import { useInventory, useCreateMovement, useMovementsByInventory } from "@/entities/inventory/api";
import { useStore } from "@/app/providers/auth";
import type { Inventory, MovementType } from "@/entities/inventory/model/types";
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
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { PaginationControls } from "@/shared/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
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
  Minus,
  ShoppingCart,
  ArrowUpDown,
  History,
} from "lucide-react";
import { toast } from "sonner";

const MOVEMENT_TYPE_CONFIG: Record<
  MovementType,
  { label: string; description: string; color: string; icon: React.ReactNode }
> = {
  purchase: {
    label: "Compra",
    description: "Registrar entrada de mercadería por compra",
    color: "bg-blue-500",
    icon: <ShoppingCart className="h-4 w-4" />,
  },
  sale: {
    label: "Venta",
    description: "Registrar salida por venta completada",
    color: "bg-green-500",
    icon: <DollarSign className="h-4 w-4" />,
  },
  adjustment_in: {
    label: "Ajuste entrada",
    description: "Corregir stock hacia arriba (sin compra)",
    color: "bg-emerald-500",
    icon: <Plus className="h-4 w-4" />,
  },
  adjustment_out: {
    label: "Ajuste salida",
    description: "Corregir stock hacia abajo (sin venta)",
    color: "bg-orange-500",
    icon: <Minus className="h-4 w-4" />,
  },
};

export default function InventoryTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { selectedStore } = useStore();

  // Modal de movimiento
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(null);
  const [movementType, setMovementType] = useState<MovementType | "">("");
  const [movementQuantity, setMovementQuantity] = useState("");
  const [movementUnitCost, setMovementUnitCost] = useState("");
  const [movementNotes, setMovementNotes] = useState("");

  // Modal de historial
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyInventoryId, setHistoryInventoryId] = useState<string | null>(null);

  const storeId = selectedStore === "all" ? "all" : (selectedStore?.id || "all");

  const queryParams = {
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
    order: "DESC" as const,
    storeId,
    ...(searchTerm && { attr: "product.name", value: searchTerm }),
  };

  const { data: inventoryResponse, isLoading } = useInventory(queryParams);
  const inventories = inventoryResponse?.data || [];
  const totalInventories = inventoryResponse?.countData || 0;
  const totalPages = Math.ceil(totalInventories / pageSize);
  const stats = inventoryResponse?.stats;

  const createMovement = useCreateMovement();
  const { data: movementsResponse, isLoading: isLoadingMovements } =
    useMovementsByInventory(historyInventoryId);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handlePageChange = (page: number) => setCurrentPage(page);
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  const openMovementDialog = (inventory: Inventory, type?: MovementType) => {
    setSelectedInventory(inventory);
    setMovementType(type || "");
    setMovementQuantity("");
    setMovementUnitCost("");
    setMovementNotes("");
    setMovementDialogOpen(true);
  };

  const openHistoryDialog = (inventoryId: string) => {
    setHistoryInventoryId(inventoryId);
    setHistoryDialogOpen(true);
  };

  const handleSubmitMovement = async () => {
    if (!selectedInventory || !movementType || !movementQuantity) return;

    const qty = parseInt(movementQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error("La cantidad debe ser un número positivo");
      return;
    }

    try {
      await createMovement.mutateAsync({
        inventoryId: selectedInventory.id,
        type: movementType as MovementType,
        quantity: qty,
        ...(movementUnitCost && { unitCost: parseFloat(movementUnitCost) }),
        ...(movementNotes && { notes: movementNotes }),
      });

      toast.success("Movimiento registrado exitosamente");
      setMovementDialogOpen(false);
    } catch (error: any) {
      toast.error(error?.message || "Error al registrar movimiento");
    }
  };

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

  const getMovementBadge = (type: MovementType) => {
    const config = MOVEMENT_TYPE_CONFIG[type];
    if (!config) return <Badge variant="secondary">{type}</Badge>;
    return (
      <Badge className={config.color}>
        <span className="flex items-center gap-1">
          {config.icon}
          {config.label}
        </span>
      </Badge>
    );
  };

  const isStockOut = (type: MovementType) =>
    type === "sale" || type === "adjustment_out";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Inventario</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona el stock de tus productos
          </p>
        </div>
      </div>

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

      {/* Search */}
      <div className="bg-card border rounded-lg p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar productos en inventario..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Imagen</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Tienda</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Disponible</TableHead>
                <TableHead className="text-right">En Tránsito</TableHead>
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
        </div>
      ) : inventories.length === 0 ? (
        <div className="text-center py-12 bg-card border rounded-lg">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No hay inventarios</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm
              ? "No se encontraron productos con los filtros aplicados."
              : "No hay productos registrados en el inventario."}
          </p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Imagen</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Tienda</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Disponible</TableHead>
                <TableHead className="text-right">En Tránsito</TableHead>
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
                  <TableCell className="text-right">
                    <span className="font-semibold">
                      {inventory.stockQuantity}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        inventory.reservedQuantity > 0
                          ? "font-semibold text-yellow-600"
                          : ""
                      }
                    >
                      {inventory.reservedQuantity}
                    </span>
                  </TableCell>
                  <TableCell>{getStatusBadge(inventory.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Registrar compra"
                        onClick={() => openMovementDialog(inventory, "purchase")}
                      >
                        <ShoppingCart className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Ajustar stock"
                        onClick={() => openMovementDialog(inventory)}
                      >
                        <ArrowUpDown className="h-4 w-4 text-orange-600" />
                      </Button>
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

      {/* Dialog: Registrar Movimiento */}
      <Dialog open={movementDialogOpen} onOpenChange={setMovementDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Registrar Movimiento</DialogTitle>
            <DialogDescription>
              {selectedInventory && (
                <>
                  <span className="font-medium text-foreground">
                    {selectedInventory.product.name}
                  </span>
                  {" — "}
                  Stock actual:{" "}
                  <span className="font-semibold">
                    {selectedInventory.stockQuantity}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Tipo de movimiento */}
            <div className="space-y-2">
              <Label>Tipo de movimiento</Label>
              <Select
                value={movementType}
                onValueChange={(val) => setMovementType(val as MovementType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.entries(MOVEMENT_TYPE_CONFIG) as [
                      MovementType,
                      (typeof MOVEMENT_TYPE_CONFIG)[MovementType],
                    ][]
                  ).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        {config.icon}
                        <span>
                          {config.label}
                          <span className="text-muted-foreground text-xs ml-1">
                            — {config.description}
                          </span>
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cantidad */}
            <div className="space-y-2">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min={1}
                placeholder="Ej: 10"
                value={movementQuantity}
                onChange={(e) => setMovementQuantity(e.target.value)}
              />
              {movementType && selectedInventory && (
                <p className="text-xs text-muted-foreground">
                  {isStockOut(movementType as MovementType)
                    ? `Stock resultante: ${selectedInventory.stockQuantity - (parseInt(movementQuantity) || 0)}`
                    : `Stock resultante: ${selectedInventory.stockQuantity + (parseInt(movementQuantity) || 0)}`}
                </p>
              )}
            </div>

            {/* Costo unitario (solo para compras) */}
            {movementType === "purchase" && (
              <div className="space-y-2">
                <Label>Costo unitario (opcional)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Ej: 15.50"
                  value={movementUnitCost}
                  onChange={(e) => setMovementUnitCost(e.target.value)}
                />
                {movementUnitCost && movementQuantity && (
                  <p className="text-xs text-muted-foreground">
                    Costo total: Bs.{" "}
                    {(
                      parseFloat(movementUnitCost) *
                      parseInt(movementQuantity)
                    ).toFixed(2)}
                  </p>
                )}
              </div>
            )}

            {/* Notas */}
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                placeholder="Ej: Compra de reposición semanal"
                value={movementNotes}
                onChange={(e) => setMovementNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMovementDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitMovement}
              disabled={
                !movementType ||
                !movementQuantity ||
                parseInt(movementQuantity) <= 0 ||
                createMovement.isPending
              }
            >
              {createMovement.isPending ? "Registrando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Historial de Movimientos */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historial de Movimientos</DialogTitle>
            <DialogDescription>
              Últimos movimientos registrados para este producto
            </DialogDescription>
          </DialogHeader>

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
              {movementsResponse.data.map((movement) => (
                <div
                  key={movement.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getMovementBadge(movement.type)}
                    <div>
                      <p className="text-sm font-medium">
                        {isStockOut(movement.type) ? "-" : "+"}
                        {movement.quantity} unidades
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
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
