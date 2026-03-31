import { useParams, useNavigate } from "react-router-dom";
import { usePurchaseOrder, useConfirmPurchaseOrder, useCancelPurchaseOrder } from "@/entities/purchase-order/api";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { ArrowLeft, CheckCircle, XCircle, Package, User, FileText, Store } from "lucide-react";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendiente", variant: "outline" },
  received: { label: "Recibido", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

export function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: po, isLoading } = usePurchaseOrder(id);
  const confirmMutation = useConfirmPurchaseOrder();
  const cancelMutation = useCancelPurchaseOrder();

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="p-6 text-center py-12">
        <p className="text-muted-foreground">Orden de compra no encontrada</p>
        <Button onClick={() => navigate("/purchases")} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver
        </Button>
      </div>
    );
  }

  const status = statusConfig[po.status] || statusConfig.pending;
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("es-BO", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const handleConfirm = async () => {
    try {
      await confirmMutation.mutateAsync(po.id);
      toast.success("Compra confirmada - stock actualizado");
    } catch (e: any) {
      toast.error(e?.message || "Error al confirmar");
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(po.id);
      toast.success("Compra cancelada");
    } catch (e: any) {
      toast.error(e?.message || "Error al cancelar");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/purchases")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">Detalle de Compra</h1>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{formatDate(po.created_at)}</p>
          </div>
        </div>

        {po.status === "pending" && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={cancelMutation.isPending}>
              <XCircle className="h-4 w-4 mr-2" /> Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={confirmMutation.isPending}>
              <CheckCircle className="h-4 w-4 mr-2" /> Confirmar Recepción
            </Button>
          </div>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Proveedor</p>
              <p className="font-medium">{po.supplierName || "No especificado"}</p>
              {po.supplierContact && (
                <p className="text-xs text-muted-foreground">{po.supplierContact}</p>
              )}
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Referencia</p>
              <p className="font-medium">{po.referenceNumber || "—"}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Store className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Tienda destino</p>
              <p className="font-medium">{po.store?.name || "—"}</p>
            </div>
          </div>
        </Card>
      </div>

      {po.notes && (
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Notas</p>
          <p className="text-sm">{po.notes}</p>
        </Card>
      )}

      {/* Items */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <Package className="h-4 w-4" />
            Productos ({po.items?.length || 0})
          </h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Costo Unit.</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {po.items?.map(item => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.product?.name || "Producto"}</TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                <TableCell className="text-right">Bs. {Number(item.unitCost).toFixed(2)}</TableCell>
                <TableCell className="text-right font-semibold">
                  Bs. {Number(item.subtotal).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={3} className="text-right font-semibold">Total</TableCell>
              <TableCell className="text-right text-lg font-bold text-red-600">
                Bs. {Number(po.totalAmount).toFixed(2)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
