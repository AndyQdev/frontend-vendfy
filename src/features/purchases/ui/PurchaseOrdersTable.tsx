import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  usePurchaseOrders,
  useConfirmPurchaseOrder,
  useCancelPurchaseOrder,
  useDeletePurchaseOrder,
} from "@/entities/purchase-order/api";
import type { PurchaseOrder } from "@/entities/purchase-order/model/types";
import { formatDolares, formatMoney } from "@/shared/lib/money";
import { useStore } from "@/app/providers/auth";
import { ChipProductoEscaneado, frasesCompras, textoCompras, useFiltroEscaneado, useVozAlFiltrar } from "@/features/scanner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Button } from "@/shared/ui/button";
import { ButtonMagic } from "@/shared/ui/button-magic";
import { Sparkles } from "lucide-react";
import { CompraConIaModal } from "./CompraConIaModal";
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
import {
  ListaTarjetas,
  SoloEscritorio,
  TarjetaFila,
  FilaTitulo,
  FilaDatos,
  FilaAcciones,
} from "@/shared/ui/lista-tarjetas";
import { useAcceso } from "@/app/providers/acceso";
import { PERMISO } from "@/shared/acceso/permisos";
import { apiFetch } from "@/shared/api/client";
import { BotonExportar } from "@/shared/ui/boton-exportar";
import {
  descargarExcel,
  fechaHoraCelda,
  nombreArchivoListado,
  numeroCelda,
  traerTodas,
} from "@/shared/lib/exportar-excel";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendiente", variant: "outline" },
  received: { label: "Recibido", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

/**
 * El menú de una compra.
 *
 * Está aparte porque la tabla y la tarjeta lo necesitan igual, y porque
 * "eliminar" no puede quedarse en una de las dos versiones: una compra
 * cargada por error se borra desde donde la estés mirando.
 */
function MenuDeCompra({
  po,
  onVer,
  onConfirmar,
  onCancelar,
  onEliminar,
  gestionar,
}: {
  po: PurchaseOrder;
  /** Sin permiso de gestionar inventario, el menú solo deja ver. */
  gestionar: boolean;
  onVer: () => void;
  onConfirmar: () => void;
  onCancelar: () => void;
  onEliminar: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onVer}>
          <Eye className="mr-2 h-4 w-4" />
          Ver Detalle
        </DropdownMenuItem>
        {po.status === "pending" && gestionar && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onConfirmar}>
              <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
              Confirmar Recepción
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCancelar}>
              <XCircle className="mr-2 h-4 w-4 text-orange-600" />
              Cancelar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={onEliminar}>
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PurchaseOrdersTable() {
  const navigate = useNavigate();
  // Registrar, confirmar, cancelar o borrar una compra mueve stock: gestionar inventario.
  const puedeGestionar = useAcceso().puede(PERMISO.GESTIONAR_INVENTARIO);
  const { selectedStore } = useStore();
  const storeId = selectedStore && selectedStore !== "all" ? selectedStore.id : undefined;
  const [iaAbierto, setIaAbierto] = useState(false);

  // Escanear un producto deja solo las compras que lo tienen: a quién y a
  // cuánto se le compró la última vez.
  const filtro = useFiltroEscaneado("Muestra solo las compras de ese producto");

  const { data: response, isLoading, isFetching } = usePurchaseOrders({
    limit: 50,
    order: "DESC",
    ...(storeId && { storeId }),
    ...(filtro.producto && { productId: filtro.producto.id }),
  });

  const confirmMutation = useConfirmPurchaseOrder();
  const cancelMutation = useCancelPurchaseOrder();
  const deleteMutation = useDeletePurchaseOrder();

  // "Mermelada Arcor. Lo compraste tres veces. La última, hace cinco días."
  useVozAlFiltrar(filtro.producto, !isFetching, () =>
    frasesCompras(filtro.producto!.nombre, response?.resumen),
  );

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

  /** El total como lo cobró el proveedor; si fue en dólares, con su Bs abajo. */
  // Excel de todas las compras (la pantalla muestra las últimas 50).
  const exportar = async () => {
    const compras = await traerTodas<PurchaseOrder>((limit, offset) => {
      const qs = new URLSearchParams({ limit: String(limit), offset: String(offset), order: "DESC" });
      if (storeId) qs.append("storeId", storeId);
      if (filtro.producto) qs.append("productId", filtro.producto.id);
      return apiFetch<PurchaseOrder[]>(`/api/purchase-order?${qs.toString()}`);
    });
    const tienda = selectedStore && selectedStore !== "all" ? selectedStore.name : null;
    descargarExcel(
      [
        {
          nombre: "Compras",
          columnas: [
            { titulo: "Fecha", tipo: "texto", ancho: 18 },
            { titulo: "Proveedor", tipo: "texto", ancho: 26 },
            { titulo: "Referencia", tipo: "texto", ancho: 16 },
            { titulo: "Productos", tipo: "numero", ancho: 10 },
            { titulo: "Total (Bs)", tipo: "dinero", ancho: 12 },
            { titulo: "Total (USD)", tipo: "dinero", ancho: 12 },
            { titulo: "Tienda", tipo: "texto", ancho: 20 },
            { titulo: "Estado", tipo: "texto", ancho: 12 },
          ],
          filas: compras.map((po) => [
            fechaHoraCelda(po.created_at),
            po.supplierName || "Sin proveedor",
            po.referenceNumber || "",
            po.items?.length ?? 0,
            numeroCelda(po.totalAmount),
            po.currency === "USD" ? numeroCelda(po.totalUsd) : null,
            po.store?.name || "",
            (statusConfig[po.status] ?? statusConfig.pending).label,
          ]),
        },
        {
          nombre: "Detalle",
          columnas: [
            { titulo: "Fecha", tipo: "texto", ancho: 18 },
            { titulo: "Proveedor", tipo: "texto", ancho: 26 },
            { titulo: "Referencia", tipo: "texto", ancho: 16 },
            { titulo: "Producto", tipo: "texto", ancho: 32 },
            { titulo: "Cantidad", tipo: "numero", ancho: 10 },
            { titulo: "Costo unit. (Bs)", tipo: "dinero", ancho: 15 },
            { titulo: "Subtotal (Bs)", tipo: "dinero", ancho: 14 },
          ],
          filas: compras.flatMap((po) =>
            (po.items ?? []).map((it) => [
              fechaHoraCelda(po.created_at),
              po.supplierName || "Sin proveedor",
              po.referenceNumber || "",
              it.product?.name || "",
              numeroCelda(it.quantity),
              numeroCelda(it.unitCost),
              numeroCelda(it.subtotal),
            ]),
          ),
        },
      ],
      nombreArchivoListado(filtro.producto ? `compras-${filtro.producto.nombre}` : "compras", tienda),
    );
  };

  const totalDe = (po: PurchaseOrder) =>
    po.currency === "USD" ? (
      <>
        <span className="cifra">{formatDolares(Number(po.totalUsd ?? 0))}</span>
        <span className="cifra block text-xs font-normal text-muted-foreground">{formatMoney(Number(po.totalAmount))}</span>
      </>
    ) : (
      <span className="cifra">{formatMoney(Number(po.totalAmount))}</span>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="titulo-pagina">Compras</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Registra y gestiona tus compras por lote
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <BotonExportar onExportar={exportar} />
        {puedeGestionar ? <>
          <ButtonMagic
            onClick={() => setIaAbierto(true)}
            disabled={!storeId}
            title={storeId ? "Cargar la compra desde la nota o factura del proveedor" : "Elige una tienda para usar Crear con IA"}
            alwaysActive
          >
            <Sparkles />
            Crear con IA
          </ButtonMagic>
          <Button onClick={() => navigate("/purchases/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Compra
          </Button>
        </> : null}
        </div>
      </div>
      {storeId && <CompraConIaModal open={iaAbierto} onOpenChange={setIaAbierto} storeId={storeId} />}

      {filtro.producto && (
        <ChipProductoEscaneado
          nombre={filtro.producto.nombre}
          imagen={filtro.producto.imagen}
          cargando={isLoading}
          resumen={textoCompras(response?.resumen)}
          onQuitar={filtro.quitar}
          quitarEtiqueta="Ver todas las compras"
        />
      )}

      {/* Table */}
      {isLoading ? (
        <>
        <SoloEscritorio className="border rounded-lg">
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
        </SoloEscritorio>

        <ListaTarjetas>
          {Array.from({ length: 4 }).map((_, i) => (
            <TarjetaFila key={`skel-movil-${i}`}>
              <FilaTitulo
                titulo={<Skeleton className="h-4 w-32" />}
                subtitulo={<Skeleton className="mt-1 h-3 w-16" />}
                derecha={<Skeleton className="h-4 w-16" />}
              />
            </TarjetaFila>
          ))}
        </ListaTarjetas>
        </>
      ) : orders.length === 0 && filtro.producto ? (
        <div className="rounded-lg border bg-card py-12 text-center text-muted-foreground">
          <PackageIcon className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p>Ninguna compra tiene este producto.</p>
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={TruckIcon}
          title="Aún no registras compras"
          description="Cada vez que reabasteces, registra la compra aquí. Así actualizas el stock automáticamente y mantienes el control de costos para tus reportes."
          primaryAction={puedeGestionar ? {
            label: "Registrar compra",
            icon: Plus,
            onClick: () => navigate("/purchases/new"),
          } : undefined}
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
        <>
        <SoloEscritorio className="border rounded-lg">
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
                      {totalDe(po)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {po.store?.name || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <MenuDeCompra
                        po={po}
                        gestionar={puedeGestionar}
                        onVer={() => navigate(`/purchases/${po.id}`)}
                        onConfirmar={() => handleConfirm(po.id)}
                        onCancelar={() => handleCancel(po.id)}
                        onEliminar={() => handleDelete(po.id)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </SoloEscritorio>

        {/* En el teléfono la tarjeta se toca para ver el detalle, y lo demás
            va en la ranura de acciones: adentro del <button> de la tarjeta no
            funcionaría. */}
        <ListaTarjetas>
          {orders.map((po) => {
            const status = statusConfig[po.status] || statusConfig.pending;
            return (
              <TarjetaFila
                key={po.id}
                onClick={() => navigate(`/purchases/${po.id}`)}
                acciones={
                  // Una compra que no está pendiente solo se puede ver, y eso
                  // ya es lo que hace tocar la tarjeta.
                  po.status === "pending" && puedeGestionar ? (
                    <FilaAcciones className="justify-between">
                      <MenuDeCompra
                        po={po}
                        gestionar={puedeGestionar}
                        onVer={() => navigate(`/purchases/${po.id}`)}
                        onConfirmar={() => handleConfirm(po.id)}
                        onCancelar={() => handleCancel(po.id)}
                        onEliminar={() => handleDelete(po.id)}
                      />
                      <Button size="sm" onClick={() => handleConfirm(po.id)}>
                        <CheckCircle className="mr-1 h-4 w-4" />
                        Confirmar
                      </Button>
                    </FilaAcciones>
                  ) : null
                }
              >
                <FilaTitulo
                  titulo={po.supplierName || "Sin proveedor"}
                  subtitulo={po.referenceNumber || undefined}
                  derecha={
                    <>
                      <div className="text-right text-sm font-semibold text-red-600">
                        {totalDe(po)}
                      </div>
                      <Badge variant={status.variant} className="mt-1">
                        {status.label}
                      </Badge>
                    </>
                  }
                />
                <FilaDatos
                  datos={[
                    { etiqueta: "Fecha", valor: formatDate(po.created_at) },
                    {
                      etiqueta: "Items",
                      valor: `${po.items?.length || 0} productos`,
                    },
                    { etiqueta: "Tienda", valor: po.store?.name || "—" },
                  ]}
                />
              </TarjetaFila>
            );
          })}
        </ListaTarjetas>
        </>
      )}
    </div>
  );
}
