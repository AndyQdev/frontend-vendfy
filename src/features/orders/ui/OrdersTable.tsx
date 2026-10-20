

import { useState, useMemo, useRef, useEffect } from "react";
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
  MouseSensor,
  TouchSensor,
  MeasuringStrategy,
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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { Skeleton } from "@/shared/ui/skeleton";
import { Card } from "@/shared/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Button } from "@/shared/ui/button";

import { toast } from "sonner";
import { OrderCard } from "./OrderCard";
import { OrderDetailsModal } from "./OrderDetails";
import { DeliveryTrackingModal } from "./DeliveryTrackingModal";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { ChipProductoEscaneado, frasesPedidos, textoVentas, useFiltroEscaneado, useVozAlFiltrar } from "@/features/scanner";

type DateFilter = "day" | "week" | "month" | "year";

/** Cómo se dice el período del tablero en el resumen del producto escaneado. */
const PERIODO: Record<DateFilter, string> = {
  day: "Hoy",
  week: "Esta semana",
  month: "Este mes",
  year: "Este año",
};

// Configuración de columnas del Kanban
/** Los dos bordes de la pantalla, que en móvil pasan de columna al arrastrar. */
const BORDE_ANTERIOR = "borde-anterior";
const BORDE_SIGUIENTE = "borde-siguiente";

const KANBAN_COLUMNS = [
  {
    // Primera por una razón: es la bandeja de "esto todavía no es una venta".
    // Arrastrar de acá a Pendiente es lo que confirma disponibilidad y recién
    // ahí descuenta el stock.
    id: OrderStatus.POR_CONFIRMAR,
    title: "Por confirmar",
  },
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
    [OrderStatus.POR_CONFIRMAR]: { primary: '#E67E22', pastel: '#E67E2215' }, // Naranja
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
  altoCuerpo,
  sortOrder,
  onToggleSort,
}: {
  column: typeof KANBAN_COLUMNS[0];
  orders: Order[];
  onViewDetails: (order: Order) => void;
  isActive: boolean;
  activeId: string | null;
  draggedOrderId: string | null;
  /** En móvil lo decide la pantalla, no una constante. Ver `altoDelTablero`. */
  altoCuerpo?: number | null;
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
        // El alto medido pisa la cuenta fija: cuando viene, hay que soltar
        // también el techo de 700 px, que si no lo recorta igual.
        className={`bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-b-lg p-3 flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] transition-all duration-200 ${
          altoCuerpo ? "max-h-none" : "h-[calc(100dvh-280px)] max-h-[700px]"
        }`}
        style={{
          backgroundColor: isActive ? `${colors.pastel}80` : undefined,
          ...(altoCuerpo ? { height: altoCuerpo } : {}),
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
  // Pedido recién movido a "en camino": dispara la modal del link del repartidor
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const navigate = useNavigate();
  const updateOrderMutation = useUpdateOrder();
  const queryClient = useQueryClient();

  // Determinar el storeId
  const storeId = selectedStore === "all" ? undefined : selectedStore?.id;

  // Escanear un producto deja solo los pedidos que lo tienen, con su resumen.
  // Con un pedido abierto, la lectura es suya (lo arma) o abre la hoja de
  // siempre: no filtra el tablero que quedó detrás.
  const filtro = useFiltroEscaneado("Muestra solo los pedidos con ese producto", !detailsModalOpen);

  // Obtener todas las órdenes. Los mismos parámetros arman la clave que usa
  // el arrastre para actualizar el tablero al instante.
  const paramsPedidos = {
    limit: 200,
    offset: 0,
    order: sortOrder,
    ...(storeId && { storeId }),
    dateFilter,
    ...(filtro.producto && { productId: filtro.producto.id }),
  };
  const { data: ordersResponse, isLoading, isFetching } = useOrders(paramsPedidos);
  // "Mermelada Arcor. Está en tres pedidos." (los del período del tablero)
  useVozAlFiltrar(filtro.producto, !isFetching, () =>
    frasesPedidos(filtro.producto!.nombre, ordersResponse?.stats?.producto?.ventas ?? ordersResponse?.data?.length ?? 0),
  );

  const allOrders = ordersResponse?.data || [];

  // Agrupar órdenes por estado
  const ordersByStatus = useMemo(() => {
    const grouped: Record<OrderStatus, Order[]> = {
      [OrderStatus.POR_CONFIRMAR]: [],
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

  /**
   * Mouse y dedo activan distinto, y tiene que ser así.
   *
   * Con el mouse alcanza mover 8 px: el puntero no scrollea. Con el dedo eso
   * es un desastre -cualquier intento de bajar por la lista se convierte en un
   * arrastre-, así que el dedo pide mantener presionado, que además es el
   * gesto que ya conoce todo el mundo de mover un ícono en el home de Android.
   *
   * Un PointerSensor solo no sirve para esto: atiende a los dos con la misma
   * regla, y una de las dos siempre queda mal.
   */
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    })
  );

  /**
   * En el teléfono el tablero es una columna por pantalla, no seis apiladas.
   *
   * Seis listas una debajo de otra dejan de ser un tablero: para ver "En
   * camino" hay que pasar por todo lo demás. Y la salida obvia -poner las seis
   * de costado y desplazar- es justo la que no funciona: en este proyecto se
   * intentó tres veces y las tres se fue en diagonal, porque adentro de cada
   * columna ya hay un scroll vertical. Con una sola columna montada no hay
   * segundo eje con el que pelear.
   */
  const esMovil = useIsMobile();
  const [columnaMovil, setColumnaMovil] = useState(0);

  const moverColumna = (paso: number) => {
    setColumnaMovil((previo) => {
      const siguiente = previo + paso;
      if (siguiente < 0 || siguiente >= KANBAN_COLUMNS.length) return previo;
      return siguiente;
    });
  };

  // El deslizar del dedo para cambiar de columna. Va a mano y no con scroll
  // CSS: un contenedor que se desplaza de costado volvería a traer el
  // problema de los dos ejes.
  const inicioDelToque = useRef<{ x: number; y: number } | null>(null);

  const alEmpezarToque = (evento: React.TouchEvent) => {
    const toque = evento.touches[0];
    inicioDelToque.current = { x: toque.clientX, y: toque.clientY };
  };

  const alSoltarToque = (evento: React.TouchEvent) => {
    const inicio = inicioDelToque.current;
    inicioDelToque.current = null;
    // Durante un arrastre manda dnd-kit; el deslizar no se mete.
    if (!inicio || activeOrder) return;

    const toque = evento.changedTouches[0];
    const dx = toque.clientX - inicio.x;
    const dy = toque.clientY - inicio.y;

    // Claramente horizontal, o era alguien bajando por la lista.
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    moverColumna(dx < 0 ? 1 : -1);
  };

  /**
   * Cuánto alto queda de verdad para el tablero.
   *
   * La cuenta fija de `100dvh - 280px` es una adivinanza: encima de la columna
   * hay un título, unos filtros y ahora el carril de estados, y eso cambia con
   * el ancho y con el idioma. Se mide dónde arranca el tablero y se le da todo
   * lo que sobra hasta el final de la pantalla.
   *
   * Se mide al montar y al cambiar el tamaño, no al scrollear: `top` es
   * relativo a la ventana y con la página corrida daría un número menor.
   */
  const refTablero = useRef<HTMLDivElement>(null);
  const [altoDelTablero, setAltoDelTablero] = useState<number | null>(null);

  useEffect(() => {
    if (!esMovil) {
      setAltoDelTablero(null);
      return;
    }

    const medir = () => {
      const nodo = refTablero.current;
      if (!nodo) return;
      const arriba = nodo.getBoundingClientRect().top + window.scrollY;
      const libre = window.innerHeight - arriba + window.scrollY - 16;
      // Un piso, por si se mide en un momento raro del montaje.
      setAltoDelTablero(Math.max(260, libre));
    };

    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [esMovil]);

  /**
   * Arrastrar hasta el borde pasa de columna, como mover un ícono entre
   * pantallas del home. Se limita a uno por vez: sin esto, dejar el dedo
   * quieto en el borde recorre las seis columnas en un segundo.
   */
  const ultimoAvance = useRef(0);

  const avanzarPorBorde = (paso: number) => {
    const ahora = Date.now();
    if (ahora - ultimoAvance.current < 700) return;
    ultimoAvance.current = ahora;
    moverColumna(paso);
  };

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

    // Los bordes no son una columna: son el gesto de pasar a la siguiente.
    if (over?.id === BORDE_ANTERIOR) return avanzarPorBorde(-1);
    if (over?.id === BORDE_SIGUIENTE) return avanzarPorBorde(1);

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
    // Soltar sobre un borde no cambia de estado: solo se estaba paginando.
    if (over.id === BORDE_ANTERIOR || over.id === BORDE_SIGUIENTE) return;

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

    moverPedido(order, newStatus);
  };

  // Cambiar de estado: lo usa el arrastre y el "Pasar a…" del pedido armado.
  const moverPedido = (order: Order, newStatus: OrderStatus) => {
    const orderId = order.id;

    // Guardar el query key - DEBE coincidir con el queryKey de useOrders
    const queryKey = ['orders', paramsPedidos];

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
          // Salió en camino: ofrecemos compartir el link del repartidor para
          // que el cliente lo siga desde el botón del WhatsApp que ya recibió.
          if (newStatus === OrderStatus.EN_CAMINO) {
            setTrackingOrder({ ...order, status: newStatus });
          }
        },
        onError: () => {
          // Revertir en caso de error
          queryClient.setQueryData(queryKey, previousData);
          toast.error("Error al actualizar el estado de la orden");
        },
      }
    );
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="titulo-pagina">Pedidos</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
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
            onClick={() => navigate("/whatsapp?config=notifications")}
            className="gap-2 text-xs"
          >
            <Bell className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Notificaciones</span>
          </Button>
        </div>
      </div>

      {filtro.producto && (
        <ChipProductoEscaneado
          nombre={filtro.producto.nombre}
          imagen={filtro.producto.imagen}
          cargando={isLoading}
          resumen={textoVentas(ordersResponse?.stats?.producto, PERIODO[dateFilter], "pedido", allOrders.length)}
          onQuitar={filtro.quitar}
          quitarEtiqueta="Ver todos los pedidos"
        />
      )}

      {/* Tablero Kanban */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, colIdx) => (
            <div key={colIdx} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-8 rounded-full" />
              </div>
              <div className="space-y-3 rounded-lg border border-dashed p-2 min-h-[400px]">
                {Array.from({ length: colIdx === 0 ? 3 : colIdx === 3 ? 2 : 1 }).map((_, cardIdx) => (
                  <Card key={cardIdx} className="p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-32" />
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        // En móvil la columna de destino no existe cuando empieza el arrastre:
        // se monta al pasar de página. Con la medición por defecto -una sola
        // vez al arrancar- dnd-kit no la vería y la tarjeta no tendría dónde
        // caer. En escritorio están las seis desde el principio y no hace
        // falta pagar esa medición.
        measuring={
          esMovil
            ? { droppable: { strategy: MeasuringStrategy.Always } }
            : undefined
        }
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {esMovil ? (
          <div onTouchStart={alEmpezarToque} onTouchEnd={alSoltarToque}>
            {/* El carril de estados: dice dónde estás y deja saltar directo.
                Es un solo eje y sin scroll vertical adentro, que es la forma
                que sí funciona. */}
            <div className="carril -mx-3 mb-3 flex gap-2 px-3 pb-1">
              {KANBAN_COLUMNS.map((column, indice) => {
                const activa = indice === columnaMovil;
                return (
                  <button
                    key={column.id}
                    type="button"
                    onClick={() => setColumnaMovil(indice)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                      activa
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {column.title}
                    <span
                      className={`rounded-full px-1.5 text-[10px] tabular-nums ${
                        activa ? "bg-white/20" : "bg-muted"
                      }`}
                    >
                      {ordersByStatus[column.id].length}
                    </span>
                  </button>
                );
              })}
            </div>

            {(() => {
              const column = KANBAN_COLUMNS[columnaMovil];
              return (
                <div ref={refTablero}>
                <SortableContext
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
                    altoCuerpo={altoDelTablero}
                  />
                </SortableContext>
                </div>
              );
            })()}

            {/* Solo existen mientras se arrastra: el resto del tiempo serían
                dos franjas muertas comiéndose el ancho de la pantalla. */}
            {activeOrder && (
              <>
                <BordeDeArrastre
                  id={BORDE_ANTERIOR}
                  lado="izquierda"
                  habilitado={columnaMovil > 0}
                />
                <BordeDeArrastre
                  id={BORDE_SIGUIENTE}
                  lado="derecha"
                  habilitado={columnaMovil < KANBAN_COLUMNS.length - 1}
                />
              </>
            )}
          </div>
        ) : (
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
        )}

        {/* Overlay durante el drag */}
        <DragOverlay>
          {activeOrder ? (
            <div className="rotate-3 scale-105">
              <OrderCard order={activeOrder} onViewDetails={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      )}

      {/* Modal de detalles */}
      <OrderDetailsModal
        order={selectedOrder}
        open={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        onCambiarEstado={(order, status) => {
          setDetailsModalOpen(false);
          moverPedido(order, status);
        }}
      />

      {/* Link del repartidor al pasar a "En camino" */}
      <DeliveryTrackingModal
        order={trackingOrder}
        open={!!trackingOrder}
        onOpenChange={(open) => !open && setTrackingOrder(null)}
      />

    </div>
  );
}

/**
 * La franja del borde que pasa de columna mientras se arrastra.
 *
 * Es el mismo gesto que mover un ícono entre pantallas del home de Android:
 * llevás la tarjeta al costado y el tablero avanza. Es droppable y no un
 * cálculo de coordenadas a mano para que lo resuelva la misma detección de
 * colisiones que el resto, y no dos sistemas que se contradicen.
 */
function BordeDeArrastre({
  id,
  lado,
  habilitado,
}: {
  id: string;
  lado: "izquierda" | "derecha";
  habilitado: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !habilitado });
  const Flecha = lado === "izquierda" ? ChevronLeft : ChevronRight;

  if (!habilitado) return null;

  return (
    <div
      ref={setNodeRef}
      aria-hidden
      className={`fixed inset-y-0 z-50 grid w-14 place-items-center transition-colors md:hidden ${
        lado === "izquierda" ? "left-0" : "right-0"
      } ${
        isOver
          ? "bg-primary/25"
          : lado === "izquierda"
            ? "bg-gradient-to-r from-black/10 to-transparent"
            : "bg-gradient-to-l from-black/10 to-transparent"
      }`}
    >
      <Flecha
        className={`h-6 w-6 ${isOver ? "text-primary" : "text-muted-foreground/60"}`}
      />
    </div>
  );
}
