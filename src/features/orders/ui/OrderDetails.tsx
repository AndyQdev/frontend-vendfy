import { Order, OrderStatus, OrderType } from "@/entities/order/model/types";
import { formatMoney } from "@/shared/lib/money";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Package, MapPin } from "lucide-react";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Separator } from "@/shared/ui/separator";
import { formatearCantidad } from "@/entities/inventory/model/envases";

export function OrderDetailsModal({ order, open, onClose }: { order: Order | null; open: boolean; onClose: () => void }) {
  if (!order) return null;

  const getTypeLabel = (type: OrderType) => {
    const labels = {
      [OrderType.QUICK]: "Venta Rápida",
      [OrderType.DELIVERY]: "Delivery",
      [OrderType.INSTALLMENT]: "A Cuotas",
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status: OrderStatus) => {
    const labels = {
      [OrderStatus.PENDIENTE]: "Pendiente",
      [OrderStatus.EN_PROCESO]: "En Proceso",
      [OrderStatus.EN_CAMINO]: "En Camino",
      [OrderStatus.COMPLETADO]: "Completado",
      [OrderStatus.CANCELADO]: "Cancelado",
    };
    return labels[status] || status;
  };

  const totalItems = order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalles de la Orden</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información del cliente */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Cliente</h3>
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="font-semibold">
                  {order.customer?.name?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{order.customer?.name || "Sin cliente"}</p>
                {order.customer?.email && (
                  <p className="text-sm text-muted-foreground">{order.customer.email}</p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Información de la orden */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Tipo</p>
              <p className="font-semibold">{getTypeLabel(order.type)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Estado</p>
              <p className="font-semibold">{getStatusLabel(order.status)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Fecha</p>
              <p className="font-semibold">
                {format(new Date(order.created_at), "dd MMMM yyyy, HH:mm", { locale: es })}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Pago</p>
              <p className="font-semibold capitalize">{order.paymentMethod}</p>
            </div>
          </div>

          <Separator />

          {/* Productos */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Productos ({totalItems})</h3>
            <div className="space-y-2">
              {order.items?.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3 flex-1">
                    <Package className="w-5 h-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {item.storeProduct?.product?.name || "Producto"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.baseQuantity ? (
                          <>
                            {item.quantity} ×{" "}
                            {formatearCantidad(
                              item.baseQuantity,
                              item.unit ?? item.storeProduct?.product?.baseUnit ?? undefined
                            )}
                            {item.quantity > 1 && (
                              <>
                                {" = "}
                                {formatearCantidad(
                                  item.baseQuantity * item.quantity,
                                  item.unit ?? item.storeProduct?.product?.baseUnit ?? undefined
                                )}
                              </>
                            )}
                          </>
                        ) : (
                          <>Cantidad: {item.quantity}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold">{formatMoney(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Delivery info */}
          {order.type === OrderType.DELIVERY && order.deliveryInfo && (
            <>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Información de Envío</h3>
                <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-orange-600 dark:text-orange-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Dirección</p>
                      <p className="text-sm text-muted-foreground">{order.deliveryInfo.address}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-orange-200 dark:border-orange-800">
                    <span className="text-sm font-medium">Costo de envío</span>
                    <span className="font-semibold">{formatMoney(order.deliveryInfo.cost)}</span>
                  </div>
                  {order.deliveryInfo.notes && (
                    <p className="text-sm text-muted-foreground italic">"{order.deliveryInfo.notes}"</p>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Installment info */}
          {order.type === OrderType.INSTALLMENT && order.installmentInfo && (
            <>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Información de Cuotas</h3>
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Número de cuotas</span>
                    <span className="font-semibold">{order.installmentInfo.numberOfInstallments}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Próximo pago</span>
                    <span className="font-semibold">
                      {format(new Date(order.installmentInfo.nextPaymentDate), "dd MMM yyyy", { locale: es })}
                    </span>
                  </div>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Notas */}
          {order.notes && (
            <>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Notas</h3>
                <p className="text-sm text-muted-foreground italic p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  "{order.notes}"
                </p>
              </div>
              <Separator />
            </>
          )}

          {/* Total */}
          <div className="bg-muted p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-gray-700 dark:text-gray-200">Total</span>
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatMoney(order.totalAmount)}</span>
            </div>
            <div className="flex items-center justify-between mt-2 text-sm">
              <span className="text-muted-foreground">Total recibido</span>
              <span className="font-semibold">{formatMoney(order.totalReceived)}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}