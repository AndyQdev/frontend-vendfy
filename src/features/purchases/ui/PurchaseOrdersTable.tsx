import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  usePurchaseOrders,
  useConfirmPurchaseOrder,
  useCancelPurchaseOrder,
  useDeletePurchaseOrder,
} from "@/entities/purchase-order/api";
import type { PurchaseOrder } from "@/entities/purchase-order/model/types";
import { useStore } from "@/app/providers/auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState } from "@/shared/ui/empty-state";
import { Truck as TruckIcon, Package as PackageIcon, BarChart3 as ChartIcon, DollarSign as DollarIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Plus,
  ShoppingBag,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Trash2,
  Eye,
  Package,
} from "lucide-react";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendiente", variant: "outline" },
  received: { label: "Recibido", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

export function PurchaseOrdersTable() {
  const navigate = useNavigate();
  const { selectedStore } = useStore();
  const storeId = selectedStore && selectedStore !== "all" ? selectedStore.id : undefined;

  const { data: response, isLoading } = usePurchaseOrders({
    limit: 50,
    order: "DESC",
    ...(storeId && { storeId }),
  });

  const confirmMutation = useConfirmPurchaseOrder();
  const cancelMutation = useCancelPurchaseOrder();
  const deleteMutation = useDeletePurchaseOrder();

  const orders = response?.data || [];

  const handleConfirm = async (id: string) => {
    try {
      await confirmMutation.mutateAsync(id);
      toast.success("Compra confirmada - stock actualizado");
    } catch (error: any) {
      toast.error(error?.message || "Error al confirmar");
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelMutation.mutateAsync(id);
      toast.success("Compra cancelada");
    } catch (error: any) {
      toast.error(error?.message || "Error al cancelar");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta orden de compra?")) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Compra eliminada");
    } catch (error: any) {
      toast.error(error?.message || "Error al eliminar");
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("es-BO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return `Bs. ${Number(amount).toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Compras</h1>
          <p className="text-muted-foreground mt-1">
            Registra y gestiona tus compras por lote
          </p>
        </div>
        <Button onClick={() => navigate("/purchases/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Compra
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Tienda</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[80px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={TruckIcon}
          title="Aún no registras compras"
          description="Cada vez que reabasteces, registra la compra aquí. Así actualizas el stock automáticamente y mantienes el control de costos para tus reportes."
          primaryAction={{
            label: "Registrar compra",
            icon: Plus,
            onClick: () => navigate("/purchases/new"),
          }}
          faqs={[
            {
              icon: PackageIcon,
              title: "¿Qué pasa con el stock?",
              body: "Al confirmar una compra, las unidades entran al inventario automáticamente. No tienes que ajustar nada manualmente.",
            },
            {
              icon: DollarIcon,
              title: "¿Cómo afecta al costo?",
              body: "El costo unitario de cada compra se promedia con el existente. Tu margen real se calcula con este costo.",
            },
            {
              icon: ChartIcon,
              title: "¿Aparece en reportes?",
              body: "Sí. Cada compra queda en Movimientos y suma a tus estadísticas de gasto y rotación.",
            },
          ]}
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Tienda</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[80px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((po) => {
                const status = statusConfig[po.status] || statusConfig.pending;
                return (
                  <TableRow key={po.id}>
                    <TableCell className="text-sm">
                      {formatDate(po.created_at)}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {po.supplierName || "Sin proveedor"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {po.referenceNumber || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">{po.items?.length || 0} productos</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-red-600">
                      {formatCurrency(po.totalAmount)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {po.store?.name || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/purchases/${po.id}`)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver Detalle
                          </DropdownMenuItem>
                          {po.status === "pending" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleConfirm(po.id)}>
                                <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                                Confirmar Recepción
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCancel(po.id)}>
                                <XCircle className="mr-2 h-4 w-4 text-orange-600" />
                                Cancelar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDelete(po.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
