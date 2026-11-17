import { Order, OrderType, OrderStatus } from "@/entities/order/model/types";
import { formatMoney } from "@/shared/lib/money";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DollarSign, ShoppingCart, Truck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";

// Obtener colores pasteles según el estado
const getStatusColors = (status: OrderStatus) => {
  const colorMap = {
    [OrderStatus.PENDIENTE]: { primary: '#F1C40F', pastel: '#F1C40F15' }, // Amarillo
    [OrderStatus.EN_PROCESO]: { primary: '#3498DB', pastel: '#3498DB15' }, // Azul
    [OrderStatus.EN_CAMINO]: { primary: '#9B59B6', pastel: '#9B59B615' }, // Morado
    [OrderStatus.COMPLETADO]: { primary: '#2ECC71', pastel: '#2ECC7115' }, // Verde
    [OrderStatus.CANCELADO]: { primary: '#E74C3C', pastel: '#E74C3C15' }, // Rojo
  };
  return colorMap[status] || { primary: '#7A5CFF', pastel: '#7A5CFF15' };
};

// Componente de tarjeta de orden arrastrable
export function OrderCard({ order, onViewDetails }: { order: Order; onViewDetails: (order: Order) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: order.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const getTypeIcon = (type: OrderType) => {
    switch (type) {
      case OrderType.QUICK:
        return ShoppingCart;
      case OrderType.DELIVERY:
        return Truck;
      case OrderType.INSTALLMENT:
        return DollarSign;
      default:
        return ShoppingCart;
    }
  };

  const TypeIcon = getTypeIcon(order.type);
  const colors = getStatusColors(order.status);
  const totalItems = order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const firstProduct = order.items?.[0];

  const getTypeLabel = (type: OrderType) => {
    const labels = {
      [OrderType.QUICK]: "Rápida",
      [OrderType.DELIVERY]: "Delivery",
      [OrderType.INSTALLMENT]: "Cuotas",
    };
    return labels[type] || "Orden";
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="transition-all"
      data-piloto={`pedido:${order.id}`}
    >
      <div
        {...listeners}
        onClick={(e) => {
          // Solo abrir detalles si no se está arrastrando
          if (!isDragging) {
            onViewDetails(order);
          }
        }}
        className={`overflow-hidden rounded-lg text-left transition-all group relative ${
          isDragging 
            ? 'scale-105 shadow-2xl cursor-grabbing' 
            : 'hover:scale-[1.01] hover:shadow-md border border-gray-200/50 dark:border-gray-700/50 cursor-grab hover:cursor-grab'
        }`}
        style={{
          backgroundColor: colors.pastel,
          boxShadow: isDragging ? '0 8px 24px rgba(0, 0, 0, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
          ...(isDragging && {
            outline: `4px solid ${colors.primary}50`,
            borderColor: colors.primary,
            borderWidth: '2px',
          }),
        }}
      >
        {/* Línea vertical al inicio - estilo Notion */}
        <div 
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ backgroundColor: colors.primary }}
        />
        
        <div className="flex flex-col justify-center px-3 py-2.5 ml-2">
          {/* Nombre del cliente y tipo */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarFallback className="text-[10px] font-semibold">
                  {order.customer?.name?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight">
                {order.customer?.name || "Sin cliente"}
              </p>
              {order.number && (
                <span className="shrink-0 font-mono text-[11px] text-gray-500 dark:text-gray-400">
                  #{order.number}
                </span>
              )}
            </div>
            {/* Tipo de orden con tooltip */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="shrink-0">
                    <TypeIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{getTypeLabel(order.type)}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          {/* Producto principal */}
          {firstProduct && (
            <p className="truncate text-xs text-gray-600 dark:text-gray-300 mb-1.5 ml-8">
              {firstProduct.quantity}x {firstProduct.storeProduct?.product?.name || "Producto"}
              {totalItems > 1 && ` +${totalItems - 1} más`}
            </p>
          )}
          
          {/* Total */}
          <div className="flex items-center gap-1 text-xs ml-8">
            <span className="text-gray-500 dark:text-gray-400">Total:</span>
            <span className="font-semibold text-gray-800 dark:text-gray-100">
              {formatMoney(order.totalAmount)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}