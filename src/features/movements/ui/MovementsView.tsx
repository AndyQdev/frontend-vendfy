import { useState, useEffect } from "react";
import { useOrders } from "@/entities/order/api";
import { useMovements, useMovementKpis } from "@/entities/inventory/api";
import { useStore } from "@/app/providers/auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Badge } from "@/shared/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { PaginationControls } from "@/shared/ui/pagination";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";

export default function MovementsView() {
  const { selectedStore } = useStore();
  const storeId =
    selectedStore === "all" ? undefined : selectedStore?.id || undefined;

  const [activeTab, setActiveTab] = useState("ventas");

  // Paginación ventas
  const [ventasPage, setVentasPage] = useState(1);
  const [ventasPageSize, setVentasPageSize] = useState(10);

  // Paginación compras
  const [comprasPage, setComprasPage] = useState(1);
  const [comprasPageSize, setComprasPageSize] = useState(10);

  // Reset pages cuando cambia la tienda
  useEffect(() => {
    setVentasPage(1);
    setComprasPage(1);
  }, [storeId]);

  // KPIs globales desde endpoint dedicado
  const { data: kpisResponse, isLoading: isLoadingKpis } = useMovementKpis(storeId);
  const kpis = kpisResponse?.data;

  // Ventas: órdenes completadas
  const { data: ordersResponse, isLoading: isLoadingOrders } = useOrders({
    limit: ventasPageSize,
    offset: (ventasPage - 1) * ventasPageSize,
    order: "DESC",
    storeId,
    status: "completado",
  });

  // Compras: movimientos tipo purchase
  const { data: movementsResponse, isLoading: isLoadingMovements } =
    useMovements({
      limit: comprasPageSize,
      offset: (comprasPage - 1) * comprasPageSize,
      order: "DESC",
      type: "purchase",
      storeId,
    });

  const orders = ordersResponse?.data || [];
  const totalOrders = ordersResponse?.countData || 0;
  const ventasTotalPages = Math.ceil(totalOrders / ventasPageSize);

  const movements = movementsResponse?.data || [];
  const totalMovements = movementsResponse?.countData || 0;
  const comprasTotalPages = Math.ceil(totalMovements / comprasPageSize);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("es-BO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Movimientos</h1>
        <p className="text-muted-foreground mt-1">
          Registro de ventas y compras de mercadería
        </p>
      </div>

      {/* KPI Cards */}
      {isLoadingKpis ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg animate-pulse w-10 h-10" />
                <div className="flex-1">
                  <div className="h-3 bg-muted rounded w-24 animate-pulse mb-2" />
                  <div className="h-6 bg-muted rounded w-32 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : kpis ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Ingresos por Ventas */}
          <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ingresos</p>
                <p className="text-2xl font-semibold text-green-600">
                  Bs. {kpis.totalVentas.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">Total facturado en ventas</p>
              </div>
            </div>
          </div>

          {/* Total Invertido en Compras */}
          <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Invertido</p>
                <p className="text-2xl font-semibold text-red-600">
                  Bs. {kpis.totalCompras.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">Total gastado en compras</p>
              </div>
            </div>
          </div>

          {/* Ganancia Neta */}
          <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ganancia Neta</p>
                <p className={`text-2xl font-semibold ${kpis.gananciaReal >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  Bs. {kpis.gananciaReal.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">Ingresos − costo de lo vendido</p>
              </div>
            </div>
          </div>

          {/* Margen */}
          <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${kpis.margen >= 30 ? 'bg-emerald-100 dark:bg-emerald-900/20' : kpis.margen >= 10 ? 'bg-yellow-100 dark:bg-yellow-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
                <TrendingUp className={`h-5 w-5 ${kpis.margen >= 30 ? 'text-emerald-600 dark:text-emerald-400' : kpis.margen >= 10 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Margen</p>
                <p className={`text-2xl font-semibold ${kpis.margen >= 30 ? "text-emerald-600" : kpis.margen >= 10 ? "text-yellow-600" : "text-red-600"}`}>
                  {kpis.margen.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Rentabilidad sobre ventas</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Tabs: Ventas / Compras */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ventas" className="flex items-center gap-2">
            <ArrowUpCircle className="h-4 w-4" />
            Ventas ({totalOrders})
          </TabsTrigger>
          <TabsTrigger value="compras" className="flex items-center gap-2">
            <ArrowDownCircle className="h-4 w-4" />
            Compras ({totalMovements})
          </TabsTrigger>
        </TabsList>

        {/* Tab: Ventas (órdenes completadas) */}
        <TabsContent value="ventas" className="mt-4">
          {isLoadingOrders ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Productos</TableHead>
                    <TableHead>Método de pago</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(5)].map((_, j) => (
                        <TableCell key={j}>
                          <div className="h-4 bg-muted rounded w-20 animate-pulse" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 bg-card border rounded-lg">
              <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Sin ventas</h3>
              <p className="text-muted-foreground">
                No hay ventas completadas registradas.
              </p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Productos</TableHead>
                    <TableHead>Método de pago</TableHead>
                    <TableHead className="text-right">Recibido</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="text-sm">
                        {formatDate(order.created_at)}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {order.customer?.name || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {order.items?.slice(0, 2).map((item) => (
                            <span key={item.id} className="text-xs text-muted-foreground">
                              {item.storeProduct?.product?.name || "Producto"} x
                              {item.quantity}
                            </span>
                          ))}
                          {(order.items?.length || 0) > 2 && (
                            <span className="text-xs text-muted-foreground">
                              +{(order.items?.length || 0) - 2} más
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {order.paymentMethod || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        Bs. {Number(order.totalReceived || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-green-600">
                          Bs. {Number(order.totalAmount).toFixed(2)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {orders.length > 0 && (
                <div className="border-t p-4">
                  <PaginationControls
                    currentPage={ventasPage}
                    totalPages={ventasTotalPages}
                    pageSize={ventasPageSize}
                    totalItems={totalOrders}
                    onPageChange={setVentasPage}
                    onPageSizeChange={(size) => {
                      setVentasPageSize(size);
                      setVentasPage(1);
                    }}
                    pageSizeOptions={[5, 10, 20, 50]}
                  />
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Tab: Compras (movimientos tipo purchase) */}
        <TabsContent value="compras" className="mt-4">
          {isLoadingMovements ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Tienda</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Costo unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(6)].map((_, j) => (
                        <TableCell key={j}>
                          <div className="h-4 bg-muted rounded w-20 animate-pulse" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-12 bg-card border rounded-lg">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Sin compras</h3>
              <p className="text-muted-foreground">
                No hay compras de mercadería registradas.
              </p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Tienda</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Costo unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell className="text-sm">
                        {formatDate(movement.created_at)}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {movement.inventory?.product?.name || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {movement.inventory?.store?.name || "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {movement.quantity}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {movement.unitCost
                          ? `Bs. ${Number(movement.unitCost).toFixed(2)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-red-600">
                          {movement.totalCost
                            ? `Bs. ${Number(movement.totalCost).toFixed(2)}`
                            : "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground truncate max-w-[150px] block">
                          {movement.notes || "—"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {movements.length > 0 && (
                <div className="border-t p-4">
                  <PaginationControls
                    currentPage={comprasPage}
                    totalPages={comprasTotalPages}
                    pageSize={comprasPageSize}
                    totalItems={totalMovements}
                    onPageChange={setComprasPage}
                    onPageSizeChange={(size) => {
                      setComprasPageSize(size);
                      setComprasPage(1);
                    }}
                    pageSizeOptions={[5, 10, 20, 50]}
                  />
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
