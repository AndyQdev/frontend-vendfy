import { useState, useEffect } from "react";
import { useOrders } from "@/entities/order/api";
import { useStore } from "@/app/providers/auth";
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
import { PaginationControls } from "@/shared/ui/pagination";
import { Search, ShoppingCart, Package, DollarSign, Calendar, User, Store } from "lucide-react";
import { Skeleton } from "@/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { OrderType, OrderStatus, Order } from "@/entities/order/model/types";
import { formatMoney } from "@/shared/lib/money";
import { format } from "date-fns";
import { SalesDetailsModal } from "./SalesDetailsModal";

export default function SalesTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedTab, setSelectedTab] = useState<OrderType>(OrderType.QUICK);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { selectedStore } = useStore();

  // Determinar el storeId basado en el store seleccionado
  const storeId = selectedStore === "all" ? undefined : selectedStore?.id;

  // Query params para el backend - UNA SOLA PETICIÓN sin filtro de type
  const queryParams = {
    limit: 100, // Traemos más registros para tener todos disponibles
    offset: 0,
    order: "DESC" as const,
    ...(storeId && { storeId }),
    ...(searchTerm && { attr: "customer.name", value: searchTerm }),
  };

  const { data: ordersResponse, isLoading } = useOrders(queryParams);
  
  const allOrders = ordersResponse?.data || [];
  
  // Filtrar órdenes según el tab seleccionado (en el frontend)
  const filteredOrders = allOrders.filter(order => order.type === selectedTab);
  
  // Paginación en el frontend
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredOrders.length / pageSize);

  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Reset page cuando cambia el tab
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTab]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  const getStatusBadge = (status: OrderStatus) => {
    const statusConfig = {
      [OrderStatus.PENDIENTE]: { label: "Pendiente", className: "bg-yellow-500 hover:bg-yellow-600" },
      [OrderStatus.EN_PROCESO]: { label: "En Proceso", className: "bg-blue-500 hover:bg-blue-600" },
      [OrderStatus.EN_CAMINO]: { label: "En Camino", className: "bg-purple-500 hover:bg-purple-600" },
      [OrderStatus.COMPLETADO]: { label: "Completado", className: "bg-green-500 hover:bg-green-600" },
      [OrderStatus.CANCELADO]: { label: "Cancelado", className: "bg-red-500 hover:bg-red-600" },
    };
    const config = statusConfig[status] || { label: status, className: "bg-gray-500 hover:bg-gray-600" };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getTypeBadge = (type: OrderType) => {
    const typeConfig = {
      [OrderType.QUICK]: { label: "Venta Rápida", icon: ShoppingCart, className: "bg-emerald-500" },
      [OrderType.DELIVERY]: { label: "Delivery", icon: Package, className: "bg-orange-500" },
      [OrderType.INSTALLMENT]: { label: "A Cuotas", icon: DollarSign, className: "bg-blue-500" },
    };
    const config = typeConfig[type] || { label: type, icon: ShoppingCart, className: "bg-gray-500" };
    const Icon = config.icon;
    return (
      <Badge className={config.className}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Órdenes</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona todas las órdenes de venta
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Buscar por nombre de cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as OrderType)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value={OrderType.QUICK}>
            Venta Rápida ({allOrders.filter(o => o.type === OrderType.QUICK).length})
          </TabsTrigger>
          <TabsTrigger value={OrderType.DELIVERY}>
            Delivery ({allOrders.filter(o => o.type === OrderType.DELIVERY).length})
          </TabsTrigger>
          <TabsTrigger value={OrderType.INSTALLMENT}>
            A Cuotas ({allOrders.filter(o => o.type === OrderType.INSTALLMENT).length})
          </TabsTrigger>
        </TabsList>

        {/* Venta Rápida */}
        <TabsContent value={OrderType.QUICK} className="space-y-4">
          <OrdersTableContent
            orders={paginatedOrders}
            isLoading={isLoading}
            getStatusBadge={getStatusBadge}
            getTypeBadge={getTypeBadge}
            onOrderClick={handleOrderClick}
          />
        </TabsContent>

        {/* Delivery */}
        <TabsContent value={OrderType.DELIVERY} className="space-y-4">
          <OrdersTableContent
            orders={paginatedOrders}
            isLoading={isLoading}
            getStatusBadge={getStatusBadge}
            getTypeBadge={getTypeBadge}
            showDeliveryInfo
            onOrderClick={handleOrderClick}
          />
        </TabsContent>

        {/* A Cuotas */}
        <TabsContent value={OrderType.INSTALLMENT} className="space-y-4">
          <OrdersTableContent
            orders={paginatedOrders}
            isLoading={isLoading}
            getStatusBadge={getStatusBadge}
            getTypeBadge={getTypeBadge}
            showInstallmentInfo
            onOrderClick={handleOrderClick}
          />
        </TabsContent>
      </Tabs>

      {/* Pagination */}
      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredOrders.length}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {/* Modal de detalles */}
      <SalesDetailsModal
        order={selectedOrder}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}

// Componente de tabla reutilizable
interface OrdersTableContentProps {
  orders: any[];
  isLoading: boolean;
  getStatusBadge: (status: OrderStatus) => JSX.Element;
  getTypeBadge: (type: OrderType) => JSX.Element;
  showDeliveryInfo?: boolean;
  showInstallmentInfo?: boolean;
  onOrderClick: (order: Order) => void;
}

function OrdersTableContent({
  orders,
  isLoading,
  getStatusBadge,
  getTypeBadge,
  showDeliveryInfo,
  showInstallmentInfo,
  onOrderClick,
}: OrdersTableContentProps) {
  if (orders.length === 0 && !isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No se encontraron órdenes
      </div>
    );
  }

  const colCount = 8 + (showDeliveryInfo ? 1 : 0) + (showInstallmentInfo ? 1 : 0);

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Tienda</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Recibido</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Método Pago</TableHead>
            <TableHead>Fecha</TableHead>
            {showDeliveryInfo && <TableHead>Dirección</TableHead>}
            {showInstallmentInfo && <TableHead>Cuotas</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={`skel-${i}`}>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                {showDeliveryInfo && <TableCell><Skeleton className="h-4 w-32" /></TableCell>}
                {showInstallmentInfo && <TableCell><Skeleton className="h-4 w-16" /></TableCell>}
              </TableRow>
            ))
          ) : (
          orders.map((order) => (
            <TableRow 
              key={order.id}
              onClick={() => onOrderClick(order)}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
            >
              <TableCell className="font-mono text-xs">
                {order.id.slice(0, 8)}...
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  {order.customer?.name || "N/A"}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-muted-foreground" />
                  {order.store?.name || "N/A"}
                </div>
              </TableCell>
              <TableCell className="font-semibold">
                {formatMoney(order.totalAmount)}
              </TableCell>
              <TableCell className="text-green-600">
                {formatMoney(order.totalReceived)}
              </TableCell>
              <TableCell>{getStatusBadge(order.status)}</TableCell>
              <TableCell className="capitalize">{order.paymentMethod}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  {format(new Date(order.created_at), "dd/MM/yyyy")}
                </div>
              </TableCell>
              {showDeliveryInfo && (
                <TableCell className="max-w-xs truncate">
                  {order.deliveryInfo?.address || "N/A"}
                </TableCell>
              )}
              {showInstallmentInfo && (
                <TableCell>
                  {order.installmentInfo?.numberOfInstallments || 0} cuotas
                </TableCell>
              )}
            </TableRow>
          ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
