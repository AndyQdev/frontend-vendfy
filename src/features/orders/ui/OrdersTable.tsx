

import { useState, useMemo } from "react";
import { useOrders, useUpdateOrder } from "@/entities/order/api";
import { useStore } from "@/app/providers/auth";
import { Order, OrderStatus } from "@/entities/order/model/types";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Package,
  ArrowUpDown,
} from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Button } from "@/shared/ui/button";

import { toast } from "sonner";
import { OrderCard } from "./OrderCard";
import { OrderDetailsModal } from "./OrderDetails";
import { WhatsAppTemplatesModal } from "@/features/whatsapp/ui/WhatsAppTemplatesModal";
import { Bell } from "lucide-react";

type DateFilter = "day" | "week" | "month" | "year";

// Configuración de columnas del Kanban
const KANBAN_COLUMNS = [
  {
    id: OrderStatus.PENDIENTE,
    title: "Pendiente",
  },
  {
    id: OrderStatus.EN_PROCESO,
    title: "En Proceso",
  },
  {
    id: OrderStatus.EN_CAMINO,
    title: "En Camino",
  },
  {
    id: OrderStatus.COMPLETADO,
    title: "Completado",
  },
  {
    id: OrderStatus.CANCELADO,
    title: "Cancelado",
  },
];

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



// Componente de columna del Kanban
function KanbanColumn({
  column,
  orders,
  onViewDetails,
  isActive,
  activeId,
  draggedOrderId,
  sortOrder,
  onToggleSort,
}: {
  column: typeof KANBAN_COLUMNS[0];
  orders: Order[];
  onViewDetails: (order: Order) => void;
  isActive: boolean;
  activeId: string | null;
  draggedOrderId: string | null;
  sortOrder: 'ASC' | 'DESC';
  onToggleSort: () => void;
}) {
  const colors = getStatusColors(column.id);
  const { setNodeRef } = useDroppable({
    id: column.id,
  });
  
  // Calcular el índice donde se insertará (después de la tarjeta sobre la que estamos)
  const insertIndex = activeId 
    ? orders.findIndex(o => o.id === activeId) + 1
    : 0;
  
  // Indicador simple de línea donde se insertará
  const DropIndicator = () => (
    <div 
      className="h-0.5 my-1 rounded-full"
      style={{
        backgroundColor: colors.primary,
        boxShadow: `0 0 8px ${colors.primary}80`,
      }}
    />
  );
  
  return (
    <div ref={setNodeRef} className="flex flex-col h-full">
      {/* Header de la columna con gradiente */}
      <div 
        className="rounded-t-lg px-4 py-3 flex items-center justify-between sticky top-0 z-10 border-b-2 border-gray-200 dark:border-gray-700 transition-all duration-200"
        style={{
          background: `linear-gradient(135deg, ${colors.pastel} 0%, ${colors.primary}25 100%)`,
        }}
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-100">{column.title}</h3>
          <button
            onClick={onToggleSort}
            className="p-1 hover:bg-white/30 dark:hover:bg-black/20 rounded transition-colors"
            title={`Ordenar ${sortOrder === 'ASC' ? 'descendente' : 'ascendente'}`}
          >
            <ArrowUpDown 
              className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" 
              style={{ 
                transform: sortOrder === 'DESC' ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s ease'
              }}
            />
          </button>
        </div>
        <Badge 
          variant="secondary" 
          className="text-xs font-bold"
          style={{
            backgroundColor: `${colors.primary}20`,
            color: colors.primary,
            border: `1px solid ${colors.primary}40`,
          }}
        >
          {orders.length}
        </Badge>
      </div>

      {/* Lista de órdenes */}
      <div 
        className="bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-b-lg p-3 flex-1 overflow-y-auto h-[calc(100vh-280px)] max-h-[700px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] transition-all duration-200"
        style={{
          backgroundColor: isActive ? `${colors.pastel}80` : undefined,
        }}
      >
        <SortableContext items={orders.map((o) => o.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {orders.length === 0 ? (
              // Columna vacía
              <>
                {isActive && (
                  <div className="flex flex-col items-center justify-center py-8">
                    <DropIndicator />
                    <p className="text-xs text-muted-foreground mt-2">Soltar aquí</p>
                  </div>
                )}
                {!isActive && (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Package className="w-12 h-12 mb-2 opacity-20" />
                    <p className="text-sm">No hay órdenes</p>
                  </div>
                )}
              </>
            ) : (
              // Columna con órdenes
              orders.map((order, index) => {
                const isDraggedCard = draggedOrderId === order.id;
                const showIndicatorAfter = isActive && insertIndex === index + 1;
                
                return (
                  <div key={order.id}>
                    {/* La tarjeta (semi-transparente si es la que se está arrastrando) */}
                    <div style={{ opacity: isDraggedCard ? 0.5 : 1 }}>
                      <OrderCard order={order} onViewDetails={onViewDetails} />
                    </div>
                    
                    {/* Indicador de línea después de esta tarjeta */}
                    {showIndicatorAfter && <DropIndicator />}
                  </div>
                );
              })
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

// Modal de detalles de la orden


export default function OrdersTable() {
  const { selectedStore } = useStore();
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("week");
  const [activeColumnId, setActiveColumnId] = useState<OrderStatus | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const updateOrderMutation = useUpdateOrder();
  const queryClient = useQueryClient();

  // Determinar el storeId
  const storeId = selectedStore === "all" ? undefined : selectedStore?.id;

  // Obtener todas las órdenes
  const { data: ordersResponse, isLoading } = useOrders({
    limit: 200,
    offset: 0,
    order: sortOrder,
    ...(storeId && { storeId }),
    dateFilter,
  });

  const allOrders = ordersResponse?.data || [];

  // Agrupar órdenes por estado
  const ordersByStatus = useMemo(() => {
    const grouped: Record<OrderStatus, Order[]> = {
      [OrderStatus.PENDIENTE]: [],
      [OrderStatus.EN_PROCESO]: [],
      [OrderStatus.EN_CAMINO]: [],
      [OrderStatus.COMPLETADO]: [],
      [OrderStatus.CANCELADO]: [],
    };

    allOrders.forEach((order) => {
      if (order.status in grouped) {
        grouped[order.status].push(order);
      }
    });

    return grouped;
  }, [allOrders]);

  // Configurar sensores para drag and drop - balance entre precisión y usabilidad
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Requiere arrastrar 8px antes de activar
      },
    })
  );

  // Manejar vista de detalles
  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setDetailsModalOpen(true);
  };

  // Alternar orden de todas las columnas
  const handleToggleSort = () => {
    setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC');
  };

  // Manejar inicio del drag
  const handleDragStart = (event: DragStartEvent) => {
    const order = allOrders.find((o) => o.id === event.active.id);
    setActiveOrder(order || null);
  };

  // Manejar el drag sobre una columna (en tiempo real)
  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    
    if (!over) {
      setActiveColumnId(null);
      setActiveId(null);
      return;
    }

    // Si over.id es un OrderStatus válido, es una columna vacía
    if (Object.values(OrderStatus).includes(over.id as OrderStatus)) {
      setActiveColumnId(over.id as OrderStatus);
      setActiveId(null); // No hay orden específica, se insertará al inicio
    } else {
      // Es una orden específica
      const targetOrder = allOrders.find((o) => o.id === over.id);
      if (targetOrder) {
        setActiveColumnId(targetOrder.status);
        setActiveId(targetOrder.id);
      } else {
        setActiveColumnId(null);
        setActiveId(null);
      }
    }
  };

  // Manejar fin del drag
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveOrder(null);
    setActiveColumnId(null);
    setActiveId(null);

    if (!over) return;

    const orderId = active.id as string;
    let newStatus: OrderStatus;

    // Si over.id es un OrderStatus válido, usarlo directamente
    if (Object.values(OrderStatus).includes(over.id as OrderStatus)) {
      newStatus = over.id as OrderStatus;
    } else {
      // Si no, buscar la orden sobre la que se soltó y obtener su status
      const targetOrder = allOrders.find((o) => o.id === over.id);
      if (!targetOrder) return;
      newStatus = targetOrder.status;
    }

    // Encontrar la orden
    const order = allOrders.find((o) => o.id === orderId);
    if (!order || order.status === newStatus) return;

    // Guardar el query key - DEBE coincidir con el queryKey de useOrders
    const queryKey = ['orders', { limit: 200, offset: 0, order: sortOrder, ...(storeId && { storeId }), dateFilter }];

    // Snapshot del estado previo
    const previousData = queryClient.getQueryData(queryKey);

    // Actualizar optimistamente
    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old) return old;
      return {
        ...old,
        data: old.data.map((o: Order) =>
          o.id === orderId ? { ...o, status: newStatus } : o
        ),
      };
    });

    // Ejecutar la mutación
    updateOrderMutation.mutate(
      {
        id: orderId,
        data: { status: newStatus },
      },
      {
        onSuccess: () => {
          toast.success(`Orden movida a ${KANBAN_COLUMNS.find((c) => c.id === newStatus)?.title}`);
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        },
        onError: () => {
          // Revertir en caso de error
          queryClient.setQueryData(queryKey, previousData);
          toast.error("Error al actualizar el estado de la orden");
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando órdenes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tablero de Órdenes</h1>
          <p className="text-muted-foreground mt-1">
            Arrastra las órdenes para cambiar su estado
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs
            value={dateFilter}
            onValueChange={(value) => setDateFilter(value as DateFilter)}
          >
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="day" className="px-1.5 text-[10px] md:px-2 md:text-xs">
                Día
              </TabsTrigger>
              <TabsTrigger value="week" className="px-1.5 text-[10px] md:px-2 md:text-xs">
                Sem
              </TabsTrigger>
              <TabsTrigger value="month" className="px-1.5 text-[10px] md:px-2 md:text-xs">
                Mes
              </TabsTrigger>
              <TabsTrigger value="year" className="px-1.5 text-[10px] md:px-2 md:text-xs">
                Año
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWhatsappModalOpen(true)}
            className="gap-2 text-xs"
          >
            <Bell className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Notificaciones</span>
          </Button>
        </div>
      </div>

      {/* Tablero Kanban */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {KANBAN_COLUMNS.map((column) => (
            <SortableContext
              key={column.id}
              items={ordersByStatus[column.id].map((o) => o.id)}
              strategy={verticalListSortingStrategy}
            >
              <KanbanColumn 
                column={column} 
                orders={ordersByStatus[column.id]} 
                onViewDetails={handleViewDetails}
                isActive={activeColumnId === column.id}
                activeId={activeId}
                draggedOrderId={activeOrder?.id || null}
                sortOrder={sortOrder}
                onToggleSort={handleToggleSort}
              />
            </SortableContext>
          ))}
        </div>

        {/* Overlay durante el drag */}
        <DragOverlay>
          {activeOrder ? (
            <div className="rotate-3 scale-105">
              <OrderCard order={activeOrder} onViewDetails={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Modal de detalles */}
      <OrderDetailsModal
        order={selectedOrder}
        open={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
      />

      {/* Modal de notificaciones WhatsApp */}
      <WhatsAppTemplatesModal
        open={whatsappModalOpen}
        onOpenChange={setWhatsappModalOpen}
        storeId={storeId}
      />
    </div>
  );
}
