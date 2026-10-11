import { useEffect, useState } from "react";
import { useOrders } from "@/entities/order/api";
import { useStore } from "@/app/providers/auth";
import { ChipProductoEscaneado, textoVentas, useFiltroEscaneado } from "@/features/scanner";
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
import { useFiltrosUrl } from "@/shared/hooks/use-filtros-url";
import {
  ListaTarjetas,
  SoloEscritorio,
  TarjetaFila,
  FilaTitulo,
  FilaDatos,
  type DatoFila,
} from "@/shared/ui/lista-tarjetas";

export default function SalesTable() {
  // La búsqueda, la pestaña y la página viven en la dirección: volver o
  // recargar deja la misma pantalla.
  const { filtros, borrador, setFiltro } = useFiltrosUrl(
    { q: "", tipo: OrderType.QUICK as string, pagina: 1, tam: 10 },
    { diferidas: ["q"], reiniciar: "pagina", ignorar: ["tam", "tipo"] },
  );
  const searchTerm = filtros.q;
  const currentPage = filtros.pagina;
  const pageSize = filtros.tam;
  const selectedTab = filtros.tipo as OrderType;
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { selectedStore } = useStore();

  // Determinar el storeId basado en el store seleccionado
  const storeId = selectedStore === "all" ? undefined : selectedStore?.id;

  // Escanear un producto deja solo las ventas que lo tienen, con su resumen.
  const filtro = useFiltroEscaneado("Muestra solo las ventas de ese producto");

  // Query params para el backend - UNA SOLA PETICIÓN sin filtro de type
  const queryParams = {
    limit: 100, // Traemos más registros para tener todos disponibles
    offset: 0,
    order: "DESC" as const,
    ...(storeId && { storeId }),
    ...(searchTerm && { attr: "customer.name", value: searchTerm }),
    ...(filtro.producto && { productId: filtro.producto.id }),
  };

  const { data: ordersResponse, isLoading } = useOrders(queryParams);

  // Otro producto escaneado: desde la primera página.
  const productoFiltrado = filtro.producto?.id;
  useEffect(() => {
    if (productoFiltrado) setFiltro("pagina", 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoFiltrado]);
  
  const allOrders = ordersResponse?.data || [];

  // Los tres contadores de las pestañas, en una pasada: cada etiqueta los
  // nombra dos veces (la corta del teléfono y la larga), y no tiene sentido
  // recorrer la lista seis veces para eso.
  const conteos = allOrders.reduce<Record<string, number>>((acc, order) => {
    acc[order.type] = (acc[order.type] ?? 0) + 1;
    return acc;
  }, {});
  
  // Filtrar órdenes según el tab seleccionado (en el frontend)
  const filteredOrders = allOrders.filter(order => order.type === selectedTab);
  
  // Paginación en el frontend
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredOrders.length / pageSize);

  // El retraso del buscador y la vuelta a la primera página los maneja
  // `useFiltrosUrl`.
  const handlePageChange = (page: number) => setFiltro("pagina", page);

  const handlePageSizeChange = (newPageSize: number) => setFiltro("tam", newPageSize);

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="titulo-pagina">Ventas</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Gestiona todas las órdenes de venta
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Buscar por nombre de cliente..."
          value={borrador.q}
          onChange={(e) => setFiltro("q", e.target.value)}
          className="pl-10"
        />
      </div>

      {filtro.producto && (
        <ChipProductoEscaneado
          nombre={filtro.producto.nombre}
          imagen={filtro.producto.imagen}
          cargando={isLoading}
          resumen={textoVentas(ordersResponse?.stats?.producto, undefined, "venta", allOrders.length)}
          onQuitar={filtro.quitar}
          quitarEtiqueta="Ver todas las ventas"
        />
      )}

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={(value) => setFiltro("tipo", value)}>
        <TabsList className="grid w-full grid-cols-3">
          {/* En 360 px cada pestaña tiene unos 90 px: "Venta Rápida (12)" no
              entra. La forma corta es la que ya usa la caja para estas mismas
              tres, así que no hay un nombre nuevo que aprender. */}
          <TabsTrigger value={OrderType.QUICK}>
            <span className="md:hidden">
              Rápida ({conteos[OrderType.QUICK] ?? 0})
            </span>
            <span className="hidden md:inline">
              Venta Rápida ({conteos[OrderType.QUICK] ?? 0})
            </span>
          </TabsTrigger>
          <TabsTrigger value={OrderType.DELIVERY}>
            Delivery ({conteos[OrderType.DELIVERY] ?? 0})
          </TabsTrigger>
          <TabsTrigger value={OrderType.INSTALLMENT}>
            <span className="md:hidden">
              Cuotas ({conteos[OrderType.INSTALLMENT] ?? 0})
            </span>
            <span className="hidden md:inline">
              A Cuotas ({conteos[OrderType.INSTALLMENT] ?? 0})
            </span>
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
    <>
      <SoloEscritorio className="border rounded-lg">
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
              <TableCell className="font-mono text-xs font-semibold">
                {order.number ? `#${order.number}` : `${order.id.slice(0, 8)}...`}
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
      </SoloEscritorio>

      {/* Once columnas no caben en 360 px: la misma fila, como tarjeta. */}
      <ListaTarjetas>
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <TarjetaFila key={`skel-movil-${i}`}>
                <FilaTitulo
                  titulo={<Skeleton className="h-4 w-32" />}
                  subtitulo={<Skeleton className="mt-1 h-3 w-16" />}
                  derecha={<Skeleton className="h-4 w-16" />}
                />
              </TarjetaFila>
            ))
          : orders.map((order) => {
              // El tercer dato depende de la pestaña: en delivery lo que
              // importa es a dónde va, y en cuotas cuántas son.
              const datos: DatoFila[] = [
                {
                  etiqueta: "Fecha",
                  valor: format(new Date(order.created_at), "dd/MM/yy"),
                },
                {
                  etiqueta: "Pago",
                  valor: <span className="capitalize">{order.paymentMethod}</span>,
                },
                showDeliveryInfo
                  ? {
                      etiqueta: "Dirección",
                      valor: order.deliveryInfo?.address || "N/A",
                    }
                  : showInstallmentInfo
                    ? {
                        etiqueta: "Cuotas",
                        valor: order.installmentInfo?.numberOfInstallments || 0,
                      }
                    : {
                        etiqueta: "Recibido",
                        valor: (
                          <span className="text-green-600">
                            {formatMoney(order.totalReceived)}
                          </span>
                        ),
                      },
              ];

              return (
                <TarjetaFila key={order.id} onClick={() => onOrderClick(order)}>
                  <FilaTitulo
                    titulo={order.customer?.name || "Sin cliente"}
                    subtitulo={
                      order.number
                        ? `#${order.number}`
                        : order.store?.name || undefined
                    }
                    derecha={
                      <>
                        <p className="text-sm font-semibold">
                          {formatMoney(order.totalAmount)}
                        </p>
                        <div className="mt-1">{getStatusBadge(order.status)}</div>
                      </>
                    }
                  />
                  <FilaDatos datos={datos} />
                </TarjetaFila>
              );
            })}
      </ListaTarjetas>
    </>
  );
}
