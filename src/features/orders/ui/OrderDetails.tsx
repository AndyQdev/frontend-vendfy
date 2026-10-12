import { Order, OrderStatus, OrderType } from "@/entities/order/model/types";
import { formatMoney } from "@/shared/lib/money";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Check, MapPin, Package, PackageCheck, RotateCcw, ScanBarcode, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn";
import { sonar, useEscaner, useManejadorEscaneo } from "@/features/scanner";
import { esArmable, useArmado } from "../model/armado";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogBody as DialogBody,
} from "@/shared/ui/responsive-dialog";
import { Separator } from "@/shared/ui/separator";
import { formatearCantidad } from "@/entities/inventory/model/envases";

export function OrderDetailsModal({
  order,
  open,
  onClose,
  onCambiarEstado,
}: {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  /** Para pasarlo de estado cuando quedó armado. */
  onCambiarEstado?: (order: Order, status: OrderStatus) => void;
}) {
  const armable = esArmable(order);
  const armado = useArmado(armable ? order : null);
  const { buscar } = useEscaner();
  const [resaltado, setResaltado] = useState<{ id: string; vez: number } | null>(null);

  // Abierto un pedido por armar, la pistola tilda lo que se va poniendo en la bolsa.
  useManejadorEscaneo(
    async (lectura) => {
      const r = await buscar(lectura.codigo);
      const p = r.producto;
      if (!p) {
        sonar("error");
        toast.error("Ese código no está registrado", { description: "No es de este pedido." });
        return true;
      }
      const res = armado.escanear(p.id);
      if (res.tipo === "no_esta") {
        sonar("error");
        toast.error(`${p.name} no va en este pedido`);
      } else if (res.tipo === "ya_estan") {
        sonar("error");
        setResaltado({ id: res.linea.itemId, vez: Date.now() });
        toast.warning(`Ya están ${res.linea.lleva} de ${p.name}`, {
          description: "El pedido no lleva más.",
        });
      } else {
        sonar(res.pedidoCompleto ? "creado" : "encontrado");
        setResaltado({ id: res.linea.itemId, vez: Date.now() });
        if (res.pedidoCompleto) {
          toast.success("Pedido armado", { description: "Está todo lo que lleva." });
        } else {
          toast.success(p.name, {
            description:
              res.cuenta < res.linea.lleva
                ? `${res.cuenta} de ${res.linea.lleva}`
                : `Listo: ${res.linea.lleva} de ${res.linea.lleva}`,
            duration: 1600,
          });
        }
      }
      return true;
    },
    open && armable,
    "Tilda los productos del pedido",
  );

  // La línea recién escaneada se trae a la vista y brilla un momento.
  useEffect(() => {
    if (!resaltado) return;
    document
      .querySelector<HTMLElement>(`[data-armado-item="${resaltado.id}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const t = setTimeout(() => setResaltado(null), 1200);
    return () => clearTimeout(t);
  }, [resaltado]);

  if (!order) return null;

  // Armado, lo que sigue: sale con el repartidor o se entrega.
  const siguiente =
    order.type === OrderType.DELIVERY
      ? { status: OrderStatus.EN_CAMINO, texto: "Pasar a En camino", Icono: Truck }
      : { status: OrderStatus.COMPLETADO, texto: "Marcar completado", Icono: PackageCheck };

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

      <DialogBody>
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
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Productos ({totalItems})</h3>
              {armable && armado.empezo && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={armado.reiniciar}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Empezar de nuevo
                </Button>
              )}
            </div>

            {armable && (
              <BarraArmado
                listas={armado.listas}
                total={armado.total}
                completo={armado.completo}
                siguiente={onCambiarEstado ? siguiente : undefined}
                onSiguiente={() => onCambiarEstado?.(order, siguiente.status)}
              />
            )}

            <div className="space-y-2">
              {order.items?.map((item, index) => {
                const linea = armable ? armado.lineas.find((l) => l.itemId === item.id) : undefined;
                const cuenta = linea ? armado.armado[linea.itemId] ?? 0 : 0;
                const lista = !!linea && cuenta >= linea.lleva;
                return (
                <div
                  key={index}
                  data-armado-item={item.id}
                  className={cn(
                    "flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg transition-colors",
                    lista && "bg-success-soft dark:bg-success-soft",
                    resaltado?.id === item.id && "ring-2 ring-acento",
                  )}
                >
                  <div className="flex items-center gap-3 flex-1">
                    {linea ? (
                      <button
                        type="button"
                        onClick={() => armado.alternar(linea)}
                        aria-pressed={lista}
                        aria-label={lista ? `Destildar ${linea.nombre}` : `Tildar ${linea.nombre} como armado`}
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          lista
                            ? "border-success bg-success text-success-foreground"
                            : "border-border-strong bg-background",
                        )}
                      >
                        {lista && <Check className="h-3.5 w-3.5" aria-hidden />}
                      </button>
                    ) : (
                      <Package className="w-5 h-5 text-muted-foreground" />
                    )}
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
                  <div className="flex items-center gap-3">
                    {linea && (
                      <span
                        className={cn(
                          "cifra rounded-full px-2 py-0.5 text-xs font-semibold",
                          lista ? "text-success-soft-foreground" : "bg-background text-muted-foreground",
                        )}
                        data-testid="armado-cuenta"
                      >
                        {cuenta}/{linea.lleva}
                      </span>
                    )}
                    <p className="font-semibold">{formatMoney(item.price * item.quantity)}</p>
                  </div>
                </div>
                );
              })}
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

      </DialogBody>

      </DialogContent>
    </Dialog>
  );
}

/** Arriba de los productos: cómo armarlo, cuánto va, y qué sigue cuando está. */
function BarraArmado({
  listas,
  total,
  completo,
  siguiente,
  onSiguiente,
}: {
  listas: number;
  total: number;
  completo: boolean;
  siguiente?: { texto: string; Icono: typeof Truck };
  onSiguiente: () => void;
}) {
  if (completo) {
    return (
      <div
        className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-success/30 bg-success-soft p-3"
        data-testid="armado"
      >
        <PackageCheck className="h-5 w-5 text-success-soft-foreground" aria-hidden />
        <p className="flex-1 text-sm font-medium text-success-soft-foreground">
          Pedido armado: está todo lo que lleva.
        </p>
        {siguiente && (
          <Button size="sm" onClick={onSiguiente}>
            <siguiente.Icono className="mr-2 h-4 w-4" aria-hidden />
            {siguiente.texto}
          </Button>
        )}
      </div>
    );
  }

  if (listas === 0) {
    return (
      <div className="mb-3 flex items-center gap-3 rounded-lg border border-dashed p-3" data-testid="armado">
        <ScanBarcode className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-[13px] text-muted-foreground">
          Escaneá cada producto al ponerlo en la bolsa para armarlo. Avisa si algo no es de este pedido.
        </p>
      </div>
    );
  }

  const pct = total > 0 ? Math.round((listas / total) * 100) : 0;
  return (
    <div className="mb-3 space-y-2 rounded-lg border p-3" data-testid="armado">
      <p className="text-sm">
        Armado <span className="cifra font-semibold">{listas}</span> de{" "}
        <span className="cifra font-semibold">{total}</span>
        <span className="text-muted-foreground"> · faltan {total - listas}</span>
      </p>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Lo armado del pedido"
      >
        <div className="h-full rounded-full bg-acento transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
