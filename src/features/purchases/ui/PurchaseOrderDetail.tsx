import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { usePurchaseOrder, useConfirmPurchaseOrder, useCancelPurchaseOrder } from "@/entities/purchase-order/api";
import { fichaProductoConsulta } from "@/entities/omnibox/api";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import {
  ListaTarjetas,
  SoloEscritorio,
  TarjetaFila,
  FilaTitulo,
  FilaDatos,
} from "@/shared/ui/lista-tarjetas";
import { cn } from "@/shared/lib/cn";
import { centavos, formatDolar, formatEn, formatMoney } from "@/shared/lib/money";
import { useDolar } from "@/entities/exchange-rate/api";
import { LineaDolar } from "@/entities/exchange-rate/ui/dolar";
import {
  ArrowLeft,
  Check,
  CheckCircle,
  Minus,
  Package,
  Plus,
  RotateCcw,
  ScanBarcode,
  Store,
  User,
  FileText,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { ResultadoEscaneo } from "@/entities/product/model/escaneo";
import { sonar, useEscaner, useManejadorEscaneo } from "@/features/scanner";
import { useRecepcion } from "../model/recepcion";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendiente", variant: "outline" },
  received: { label: "Recibido", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

export function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: po, isLoading } = usePurchaseOrder(id);
  const confirmMutation = useConfirmPurchaseOrder();
  const cancelMutation = useCancelPurchaseOrder();
  const rec = useRecepcion(po);
  const [revisar, setRevisar] = useState(false);
  const [resaltado, setResaltado] = useState<{ id: string; vez: number } | null>(null);
  const { buscar, abrir: abrirHojaEscaneo } = useEscaner();

  const pendiente = po?.status === "pending";

  // ─── Dólares ───────────────────────────────────────────────────────────
  // Una compra en dólares guarda su dólar. Se suele pagar al recibir: si el
  // dólar de ese momento es otro, se cambia acá antes de confirmar y los Bs
  // se recalculan con él.
  const enDolares = po?.currency === "USD";
  const dolarCompra = Number(po?.exchangeRate ?? 0) || null;
  const { data: dolarTienda } = useDolar(enDolares && pendiente ? po?.store?.id : undefined);
  const [dolarRecibir, setDolarRecibir] = useState<number | null>(null);
  const dolarVigente = enDolares ? (pendiente ? dolarRecibir ?? dolarCompra : dolarCompra) : null;
  const moneda = enDolares ? "USD" : "BOB";

  // Lo que llegó sin estar en la compra: se suma aparte, con el último costo.
  const sumarSinPedir = (r: ResultadoEscaneo, cantidad = 1) => {
    const p = r.producto;
    if (!p || !po) return;
    const ya = rec.estado.extras.some((x) => x.productId === p.id);
    rec.sumarExtra({ productId: p.id, nombre: p.name, imagen: p.imageUrls[0] ?? null }, cantidad);
    sonar("sugerido");
    setResaltado({ id: p.id, vez: Date.now() });
    toast.warning(`${p.name} no estaba en la compra`, {
      description: "Lo sumé aparte. Revisá su costo antes de confirmar.",
      duration: 2500,
    });
    if (ya) return;
    // El costo va en la moneda de la compra: en dólares, lo último que se
    // pagó en dólares o el último en Bs pasado a dólares.
    void queryClient
      .fetchQuery(fichaProductoConsulta(p.id, po.store.id))
      .then((ficha) => {
        const enBs = ficha?.costo?.ultimoCosto ?? ficha?.costo?.costoPromedio ?? null;
        const costo = enDolares
          ? ficha?.costo?.ultimoCostoUsd ?? (enBs && dolarVigente ? centavos(enBs / dolarVigente) : null)
          : enBs;
        if (costo) rec.cambiarExtra(p.id, { costo });
      })
      .catch(() => undefined);
  };

  useManejadorEscaneo(
    async (lectura) => {
      const r = await buscar(lectura.codigo);
      const p = r.producto;
      if (!p) {
        abrirHojaEscaneo(lectura.codigo, {
          resultado: r,
          contexto: "compra",
          alRegistrar: (nuevo, alta) => sumarSinPedir(nuevo, alta.cantidad),
        });
        return true;
      }
      const linea = rec.lineas.find((l) => l.productId === p.id);
      if (!linea) {
        sumarSinPedir(r);
        return true;
      }
      const llego = (rec.estado.llego[p.id] ?? 0) + 1;
      rec.sumar(p.id, 1);
      setResaltado({ id: p.id, vez: Date.now() });
      if (llego > linea.pedido) {
        sonar("sugerido");
        toast.warning(p.name, {
          description: `Llegaron ${llego}: pediste ${linea.pedido}`,
          duration: 2000,
        });
      } else {
        sonar("encontrado");
        toast.success(p.name, {
          description: llego === linea.pedido ? `Completo: ${llego} de ${linea.pedido}` : `${llego} de ${linea.pedido}`,
          duration: 1600,
        });
      }
      return true;
    },
    pendiente,
    "Cuenta lo que llegó de esta compra",
  );

  // El renglón recién escaneado se trae a la vista y brilla un momento.
  useEffect(() => {
    if (!resaltado) return;
    Array.from(document.querySelectorAll<HTMLElement>(`[data-recepcion-item="${resaltado.id}"]`))
      .find((el) => el.offsetParent !== null)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const t = setTimeout(() => setResaltado(null), 1200);
    return () => clearTimeout(t);
  }, [resaltado]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="p-6 text-center py-12">
        <p className="text-muted-foreground">Orden de compra no encontrada</p>
        <Button onClick={() => navigate("/purchases")} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver
        </Button>
      </div>
    );
  }

  const status = statusConfig[po.status] || statusConfig.pending;
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("es-BO", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  // Contando, lo contado manda: si difiere de lo pedido, primero se muestra
  // qué cambia. Sin contar, se recibe todo lo pedido como siempre.
  const conConteo = rec.empezo && !rec.igualAlPedido;

  // Los Bs de cada línea: en una compra en dólares pendiente, con el dólar
  // al que se va a recibir (es lo que va a calcular el servidor).
  const usd = (n: unknown) => Number(n ?? 0);
  const recalcular = enDolares && pendiente && dolarVigente !== null;
  const bsUnitario = (item: (typeof po.items)[number]) =>
    recalcular ? centavos(usd(item.unitCostUsd) * dolarVigente!) : Number(item.unitCost);
  const bsSubtotal = (item: (typeof po.items)[number]) =>
    recalcular ? centavos(item.quantity * usd(item.unitCostUsd) * dolarVigente!) : Number(item.subtotal);
  const totalBs = recalcular
    ? centavos((po.items ?? []).reduce((s, i) => s + bsSubtotal(i), 0))
    : Number(po.totalAmount);
  const dolarNuevo =
    enDolares && dolarRecibir !== null && dolarRecibir !== dolarCompra ? dolarRecibir : undefined;

  const handleConfirm = async () => {
    try {
      await confirmMutation.mutateAsync(
        conConteo || dolarNuevo
          ? { id: po.id, ...(conConteo && { items: rec.items() }), ...(dolarNuevo && { exchangeRate: dolarNuevo }) }
          : po.id,
      );
      rec.reiniciar();
      setRevisar(false);
      toast.success(
        conConteo ? "Compra recibida con lo que llegó" : "Compra confirmada - stock actualizado",
        conConteo ? { description: "Las diferencias quedaron anotadas en la compra." } : undefined,
      );
    } catch (e: any) {
      toast.error(e?.message || "Error al confirmar");
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(po.id);
      rec.reiniciar();
      toast.success("Compra cancelada");
    } catch (e: any) {
      toast.error(e?.message || "Error al cancelar");
    }
  };

  const contador = (productId: string, pedido: number) => {
    const llego = rec.estado.llego[productId] ?? 0;
    return (
      <Contador
        valor={llego}
        de={pedido}
        onMenos={() => rec.sumar(productId, -1)}
        onMas={() => rec.sumar(productId, 1)}
      />
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate("/purchases")} aria-label="Volver a compras">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="titulo-pagina">Detalle de compra</h1>
              <Badge variant={status.variant}>{status.label}</Badge>
              {enDolares && <Badge variant="secondary">En dólares</Badge>}
            </div>
            <p className="cifra mt-1.5 text-[13px] text-muted-foreground">{formatDate(po.created_at)}</p>
          </div>
        </div>

        {pendiente && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={cancelMutation.isPending}>
              <XCircle className="h-4 w-4 mr-2" /> Cancelar
            </Button>
            <Button
              onClick={conConteo ? () => setRevisar(true) : handleConfirm}
              disabled={confirmMutation.isPending || (rec.empezo && rec.llegaron === 0)}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {conConteo ? "Confirmar lo que llegó" : "Confirmar Recepción"}
            </Button>
          </div>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Proveedor</p>
              <p className="font-medium">{po.supplierName || "No especificado"}</p>
              {po.supplierContact && (
                <p className="text-xs text-muted-foreground">{po.supplierContact}</p>
              )}
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Referencia</p>
              <p className="font-medium">{po.referenceNumber || "—"}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Store className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Tienda destino</p>
              <p className="font-medium">{po.store?.name || "—"}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* El dólar de la compra: se puede cambiar mientras no se recibió. */}
      {enDolares && (
        <Card className="p-4" data-testid="dolar-compra">
          <p className="mb-1 text-xs text-muted-foreground">
            {pendiente ? "Dólar de la compra · si pagás a otro al recibir, cambialo" : "Dólar de la compra"}
          </p>
          {pendiente ? (
            <LineaDolar
              valor={dolarVigente}
              delDia={dolarTienda?.dolar ?? null}
              aMano={dolarTienda?.dolar ? dolarVigente !== dolarTienda.dolar.valor : true}
              etiquetaAMano={dolarRecibir !== null && dolarRecibir !== dolarCompra ? "a mano" : "el de cuando se registró"}
              onCambio={setDolarRecibir}
              onVolver={() => setDolarRecibir(dolarTienda?.dolar?.valor ?? null)}
            />
          ) : (
            <p className="text-sm">
              <span className="text-muted-foreground">$us 1 = </span>
              <span className="cifra font-semibold">Bs {formatDolar(dolarCompra ?? 0)}</span>
            </p>
          )}
        </Card>
      )}

      {po.notes && (
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Notas</p>
          <p className="text-sm whitespace-pre-line">{po.notes}</p>
        </Card>
      )}

      {/* Recepción: escanear lo que llegó */}
      {pendiente && <BarraRecepcion rec={rec} />}

      {/* Items */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Package className="h-4 w-4" />
            Productos ({po.items?.length || 0})
          </h3>
          <span className="text-xs text-muted-foreground">
            {po.items?.reduce((s, i) => s + i.quantity, 0) || 0} unidades
          </span>
        </div>
        <SoloEscritorio>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-[60px]"></TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="text-center w-[100px]">Cantidad</TableHead>
              {pendiente && rec.empezo && (
                <TableHead className="text-center w-[150px]">Llegó</TableHead>
              )}
              <TableHead className="text-right w-[140px]">Costo unit.{enDolares ? " ($us)" : ""}</TableHead>
              <TableHead className="text-right w-[140px]">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {po.items?.map((item) => {
              const imageUrl = item.product?.imageUrls?.[0];
              const pid = item.product?.id;
              return (
                <TableRow
                  key={item.id}
                  data-recepcion-item={pid}
                  className={cn(
                    "align-middle transition-colors",
                    resaltado?.id === pid && "bg-acento/10",
                  )}
                >
                  <TableCell>
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={item.product?.name}
                        className="h-11 w-11 rounded-md object-cover border"
                      />
                    ) : (
                      <div className="h-11 w-11 rounded-md bg-muted border flex items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium leading-tight">
                      {item.product?.name || "Producto"}
                    </p>
                    {item.product?.sku && (
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                        {item.product.sku}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {item.quantity}
                  </TableCell>
                  {pendiente && rec.empezo && (
                    <TableCell className="text-center">
                      {pid && contador(pid, rec.lineas.find((l) => l.productId === pid)?.pedido ?? item.quantity)}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <span className="cifra">
                      {formatEn(enDolares ? usd(item.unitCostUsd) : Number(item.unitCost), moneda)}
                    </span>
                    {enDolares && (
                      <span className="cifra block text-xs text-muted-foreground">{formatMoney(bsUnitario(item))}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="cifra">
                      {formatEn(enDolares ? usd(item.subtotalUsd) : Number(item.subtotal), moneda)}
                    </span>
                    {enDolares && (
                      <span className="cifra block text-xs font-normal text-muted-foreground">
                        ≈ {formatMoney(bsSubtotal(item))}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </SoloEscritorio>

        {/* Las cinco columnas piden 440 px de ancho fijo; en el teléfono cada
            producto es una tarjeta. */}
        <ListaTarjetas className="p-3">
          {po.items?.map((item) => {
            const imageUrl = item.product?.imageUrls?.[0];
            const pid = item.product?.id;
            return (
              <TarjetaFila
                key={item.id}
                data-recepcion-item={pid}
                className={cn(resaltado?.id === pid && "border-acento bg-acento/10")}
              >
                <FilaTitulo
                  medio={
                    imageUrl ? (
                      <img
                        src={imageUrl}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-md border object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-muted">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )
                  }
                  titulo={item.product?.name || "Producto"}
                  subtitulo={item.product?.sku || undefined}
                  derecha={
                    <span className="text-right">
                      <span className="cifra block text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatEn(enDolares ? usd(item.subtotalUsd) : Number(item.subtotal), moneda)}
                      </span>
                      {enDolares && (
                        <span className="cifra block text-xs text-muted-foreground">
                          ≈ {formatMoney(bsSubtotal(item))}
                        </span>
                      )}
                    </span>
                  }
                />

                <FilaDatos
                  datos={[
                    { etiqueta: "Cantidad", valor: item.quantity },
                    {
                      etiqueta: "Costo unit.",
                      valor: enDolares
                        ? `${formatEn(usd(item.unitCostUsd), "USD")} (${formatMoney(bsUnitario(item))})`
                        : formatMoney(Number(item.unitCost)),
                    },
                  ]}
                />

                {pendiente && rec.empezo && pid && (
                  <div className="mt-2 flex items-center justify-between border-t pt-2">
                    <span className="etiqueta text-[10px] text-muted-foreground">Llegó</span>
                    {contador(pid, rec.lineas.find((l) => l.productId === pid)?.pedido ?? item.quantity)}
                  </div>
                )}
              </TarjetaFila>
            );
          })}
        </ListaTarjetas>

        {/* Footer con total destacado */}
        <div className="flex items-center justify-end gap-6 border-t bg-muted/30 px-4 py-3">
          <div className="text-right" data-testid="total-compra">
            <p className="text-xs text-muted-foreground">Total de la compra</p>
            <p className="cifra text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {enDolares ? formatEn(usd(po.totalUsd), "USD") : formatMoney(Number(po.totalAmount))}
            </p>
            {enDolares && dolarVigente !== null && (
              <p className="cifra text-xs text-muted-foreground">
                = {formatMoney(totalBs)} al dólar de {formatDolar(dolarVigente)}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Lo que llegó sin estar pedido */}
      {pendiente && rec.estado.extras.length > 0 && (
        <Card className="overflow-hidden" data-testid="recepcion-sin-pedir">
          <div className="border-b p-4">
            <h3 className="font-semibold">No estaban en la compra</h3>
            <p className="text-[13px] text-muted-foreground">
              Entran al confirmar. El costo es el de la última vez: corregilo si cambió.
            </p>
          </div>
          <ul className="divide-y">
            {rec.estado.extras.map((x) => (
              <li
                key={x.productId}
                data-recepcion-item={x.productId}
                className={cn(
                  "flex flex-wrap items-center gap-3 px-4 py-3 transition-colors",
                  resaltado?.id === x.productId && "bg-acento/10",
                )}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                  {x.imagen ? (
                    <img src={x.imagen} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <p className="min-w-[8rem] flex-1 font-medium leading-tight">{x.nombre}</p>
                <Contador
                  valor={x.cantidad}
                  onMenos={() => rec.cambiarExtra(x.productId, { cantidad: x.cantidad - 1 })}
                  onMas={() => rec.cambiarExtra(x.productId, { cantidad: x.cantidad + 1 })}
                />
                <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  Costo c/u{enDolares ? " ($us)" : ""}
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={x.costo || ""}
                    placeholder="0,00"
                    onChange={(e) =>
                      rec.cambiarExtra(x.productId, { costo: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className="h-8 w-24 text-right"
                  />
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Quitar ${x.nombre}`}
                  onClick={() => rec.cambiarExtra(x.productId, { cantidad: 0 })}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Antes de confirmar con diferencias: qué cambia respecto de lo pedido */}
      <AlertDialog open={revisar} onOpenChange={setRevisar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar lo que llegó</AlertDialogTitle>
            <AlertDialogDescription>
              El stock sube con lo que contaste. Las diferencias quedan anotadas en la compra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm" data-testid="recepcion-diferencias">
            {rec.diferencias.faltan.length > 0 && (
              <ListaDiferencia
                titulo="Faltaron"
                nota="Salen de la compra."
                filas={rec.diferencias.faltan.map((f) => `${f.faltan} de ${f.nombre} (de ${f.de})`)}
              />
            )}
            {rec.diferencias.deMas.length > 0 && (
              <ListaDiferencia
                titulo="Llegaron de más"
                filas={rec.diferencias.deMas.map((f) => `${f.cantidad} de ${f.nombre}`)}
              />
            )}
            {rec.diferencias.sinPedir.length > 0 && (
              <ListaDiferencia
                titulo="No estaban en la compra"
                filas={rec.estado.extras.map(
                  (x) => `${x.cantidad} de ${x.nombre} · ${x.costo ? `${formatEn(x.costo, moneda)} c/u` : "sin costo"}`,
                )}
              />
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRevisar(false)}>Seguir contando</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
              disabled={confirmMutation.isPending}
            >
              Confirmar lo que llegó
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Arriba de los productos: cómo va el conteo, o cómo empezarlo. */
function BarraRecepcion({ rec }: { rec: ReturnType<typeof useRecepcion> }) {
  if (!rec.empezo) {
    return (
      <Card className="flex flex-wrap items-center gap-3 p-4" data-testid="recepcion">
        <div className="rounded-lg bg-primary-soft p-2">
          <ScanBarcode className="h-5 w-5 text-primary-soft-foreground" aria-hidden />
        </div>
        <div className="min-w-[12rem] flex-1">
          <p className="font-medium">¿Llegó la mercadería?</p>
          <p className="text-[13px] text-muted-foreground">
            Escaneá cada producto para contarlo. Lo que falte o sobre se ajusta al confirmar.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={rec.empezarAMano}>
          Contar a mano
        </Button>
      </Card>
    );
  }

  // La barra avanza con lo pedido que llegó; lo que sobra no la pasa del 100 %.
  const cubiertas = rec.lineas.reduce(
    (s, l) => s + Math.min(l.pedido, rec.estado.llego[l.productId] ?? 0),
    0,
  );
  const faltan = rec.diferencias.faltan.reduce((s, f) => s + f.faltan, 0);
  const sinPedir = rec.diferencias.sinPedir.reduce((s, f) => s + f.cantidad, 0);
  const pct = rec.pedidas > 0 ? Math.round((cubiertas / rec.pedidas) * 100) : 0;
  const detalle = [
    faltan > 0
      ? `Faltan ${faltan} ${faltan === 1 ? "unidad" : "unidades"}`
      : "Llegó todo lo pedido",
    rec.diferencias.deMas.length > 0 ? "algunas de más" : null,
    sinPedir > 0 ? `${sinPedir} que no estaban en la compra` : null,
  ].filter(Boolean);

  return (
    <Card className="space-y-3 p-4" data-testid="recepcion">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "rounded-lg p-2",
              faltan === 0 ? "bg-success-soft text-success-soft-foreground" : "bg-primary-soft text-primary-soft-foreground",
            )}
          >
            {faltan === 0 ? <Check className="h-5 w-5" aria-hidden /> : <ScanBarcode className="h-5 w-5" aria-hidden />}
          </div>
          <div>
            <p className="font-medium">
              Llegaron <span className="cifra">{cubiertas}</span> de <span className="cifra">{rec.pedidas}</span>
            </p>
            <p className="text-[13px] text-muted-foreground">{detalle.join(" · ")}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={rec.reiniciar}>
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
          Empezar de nuevo
        </Button>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Lo que llegó de la compra"
      >
        <div className="h-full rounded-full bg-acento transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </Card>
  );
}

/** − 3/4 + : cuántos llegaron, con botones para corregir a mano. */
function Contador({
  valor,
  de,
  onMenos,
  onMas,
}: {
  valor: number;
  de?: number;
  onMenos: () => void;
  onMas: () => void;
}) {
  const completo = de != null && valor === de;
  const deMas = de != null && valor > de;
  return (
    <div className="inline-flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-7 w-7"
        aria-label="Uno menos"
        onClick={onMenos}
        disabled={valor === 0}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <span
        className={cn(
          "cifra inline-flex min-w-[3.75rem] items-center justify-center gap-1 text-sm font-semibold",
          completo && "text-success",
          deMas && "text-warning",
        )}
        data-testid="recepcion-cuenta"
      >
        {completo && <Check className="h-3.5 w-3.5" aria-hidden />}
        {valor}
        {de != null && <span className="font-normal text-muted-foreground">/{de}</span>}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-7 w-7"
        aria-label="Uno más"
        onClick={onMas}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function ListaDiferencia({ titulo, nota, filas }: { titulo: string; nota?: string; filas: string[] }) {
  return (
    <div>
      <p className="font-medium">
        {titulo}
        {nota && <span className="font-normal text-muted-foreground"> · {nota}</span>}
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
        {filas.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </div>
  );
}
