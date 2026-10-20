import { formatMoney } from "@/shared/lib/money";
import { Order } from "@/entities/order/model/types";
import { cobroEnDolaresTexto } from "@/entities/order/model/pago";
import { Badge } from "@/shared/ui/badge";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogBody as DialogBody,
} from "@/shared/ui/responsive-dialog";

interface OrderDetailsModalProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
}

export function SalesDetailsModal({ order, open, onClose }: OrderDetailsModalProps) {
  if (!order) return null;

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pagado: { label: "Pagado", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" },
      pendiente: { label: "Pendiente", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100" },
      cancelado: { label: "Cancelado", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100" },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, className: "" };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            Detalles del Pedido
          </DialogTitle>
        </DialogHeader>

      <DialogBody>
        <div className="space-y-6">
          {/* Información General */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30">
            <div>
              <p className="text-sm font-medium text-foreground">Cliente</p>
              <p className="text-base">{order.customer?.name || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Estado</p>
              {getStatusBadge(order.status)}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Total</p>
              <p className="text-lg font-bold">{formatMoney(Number(order.totalAmount))}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Recibido</p>
              <p className="text-lg font-bold">{formatMoney(Number(order.totalReceived))}</p>
            </div>
            {cobroEnDolaresTexto(order) && (
              <div className="col-span-2" data-testid="cobro-dolares-detalle">
                <p className="text-sm font-medium text-foreground">Cobrado en dólares</p>
                <p className="cifra text-base">{cobroEnDolaresTexto(order)}</p>
              </div>
            )}
          </div>

          {/* Información de Entrega */}
          {order.type === "delivery" && order.deliveryInfo && (
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2 text-foreground">Información de Entrega</h3>
              <p className="text-sm"><strong>Dirección:</strong> {order.deliveryInfo.address}</p>
              <p className="text-sm"><strong>Costo de envío:</strong> {formatMoney(order.deliveryInfo.cost)}</p>
              {order.deliveryInfo.notes && (
                <p className="text-sm"><strong>Notas:</strong> {order.deliveryInfo.notes}</p>
              )}
            </div>
          )}

          {/* Items del Pedido */}
          <div>
            <h3 className="font-semibold mb-3 text-lg text-foreground">Productos</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-primary text-primary-foreground">
                  <tr>
                    <th className="text-left p-3">Producto</th>
                    <th className="text-center p-3">Cantidad</th>
                    <th className="text-right p-3">Precio Unit.</th>
                    <th className="text-right p-3">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items?.map((item, index) => (
                    <tr 
                      key={item.id} 
                      className={index % 2 === 0 ? "" : "bg-muted/30"}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          {item.storeProduct?.product?.imageUrls?.[0] && (
                            <img 
                              src={item.storeProduct.product.imageUrls[0]} 
                              alt={item.storeProduct.product.name}
                              className="w-12 h-12 object-cover rounded"
                            />
                          )}
                          <div>
                            <p className="font-medium">{item.storeProduct?.product?.name || "N/A"}</p>
                            <p className="text-xs text-gray-500">{item.storeProduct?.product?.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-center p-3 font-medium">{item.quantity}</td>
                      <td className="text-right p-3">{formatMoney(Number(item.price))}</td>
                      <td className="text-right p-3 font-semibold">
                        {formatMoney(Number(item.price) * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/50">
                  <tr>
                    <td colSpan={3} className="p-3 text-right font-bold text-foreground">
                      Total:
                    </td>
                    <td className="p-3 text-right font-bold text-lg text-foreground">
                      {formatMoney(Number(order.totalAmount))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Cuotas */}
          {order.type === "installment" && order.installments && order.installments.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 text-lg text-foreground">Cuotas</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-primary text-primary-foreground">
                    <tr>
                      <th className="text-left p-3">Cuota</th>
                      <th className="text-right p-3">Monto</th>
                      <th className="text-center p-3">Fecha Vencimiento</th>
                      <th className="text-center p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.installments.map((installment, index) => (
                      <tr 
                        key={installment.id}
                        className={index % 2 === 0 ? "" : "bg-muted/30"}
                      >
                        <td className="p-3">
                          <p className="font-medium">Cuota {installment.installmentNumber}</p>
                          {installment.notes && (
                            <p className="text-xs text-gray-500">{installment.notes}</p>
                          )}
                        </td>
                        <td className="text-right p-3 font-semibold">
                          {formatMoney(Number(installment.amount))}
                        </td>
                        <td className="text-center p-3">
                          {new Date(installment.dueDate).toLocaleDateString()}
                        </td>
                        <td className="text-center p-3">
                          <Badge className={
                            installment.status === "paid" 
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" 
                              : installment.status === "overdue"
                              ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
                          }>
                            {installment.status === "paid" ? "Pagada" : installment.status === "overdue" ? "Vencida" : "Pendiente"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </DialogBody>

      </DialogContent>
    </Dialog>
  );
}
