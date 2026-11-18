import { useState } from "react";
import { toast } from "sonner";

import type { Order } from "@/entities/order/model/types";
import { usePayInstallment } from "@/entities/order/api";
import { SiPuede } from "@/app/providers/SiPuede";
import { PERMISO } from "@/shared/acceso/permisos";
import { formatMoney } from "@/shared/lib/money";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { NativeSelect } from "@/shared/ui/native-select";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogBody as DialogBody,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from "@/shared/ui/responsive-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";

type MedioDePago = "cash" | "qr" | "card" | "transfer";
type Cuota = NonNullable<Order["installments"]>[number];

const MEDIOS: { id: MedioDePago; nombre: string }[] = [
  { id: "cash", nombre: "Efectivo" },
  { id: "qr", nombre: "QR" },
  { id: "card", nombre: "Tarjeta" },
  { id: "transfer", nombre: "Transferencia" },
];

/** aaaa-mm-dd de hoy en hora local (no UTC). */
function hoy(): string {
  const f = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`;
}

/** dd/mm/aaaa sin que la zona horaria corra un día. */
function fechaCorta(valor: string): string {
  const soloFecha = String(valor).slice(0, 10);
  const [a, m, d] = soloFecha.split("-");
  if (a && m && d) return `${d}/${m}/${a}`;
  return new Date(valor).toLocaleDateString("es-BO");
}

function estadoDe(cuota: Cuota): "pagada" | "vencida" | "pendiente" {
  if (cuota.status === "paid") return "pagada";
  if (cuota.status === "overdue") return "vencida";
  return String(cuota.dueDate).slice(0, 10) < hoy() ? "vencida" : "pendiente";
}

const ESTADO = {
  pagada: { texto: "Pagada", variant: "success" as const },
  vencida: { texto: "Vencida", variant: "destructive" as const },
  pendiente: { texto: "Pendiente", variant: "warning" as const },
};

/**
 * Las cuotas de una venta a crédito, con su estado y el cobro.
 *
 * "Vencida" no viene guardada: es una cuota pendiente con la fecha ya pasada,
 * comparando solo el día. Cobrar suma lo recibido al pedido y marca la cuota
 * como pagada; la pantalla que lo usa se refresca sola porque el hook invalida
 * las órdenes.
 */
export function CuotasDeVenta({ order }: { order: Order }) {
  const pagar = usePayInstallment();
  const [cobrando, setCobrando] = useState<Cuota | null>(null);
  const [medio, setMedio] = useState<MedioDePago>("cash");

  const cuotas = order.installments ?? [];

  if (cuotas.length === 0) {
    return <p className="text-sm text-muted-foreground">Este pedido no tiene cuotas registradas.</p>;
  }

  const abrirCobro = (cuota: Cuota) => {
    setMedio("cash");
    setCobrando(cuota);
  };

  const cobrar = async () => {
    if (!cobrando) return;
    try {
      await pagar.mutateAsync({
        orderId: order.id,
        installmentId: cobrando.id,
        paymentMethod: medio,
      });
      toast.success(`Cuota ${cobrando.installmentNumber} cobrada`);
      setCobrando(null);
    } catch {
      // El hook ya muestra el motivo (cuota pagada, pedido cancelado, etc.).
    }
  };

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuota</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-center">Vence</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <SiPuede permisos={[PERMISO.GESTIONAR_PEDIDOS]}>
                <TableHead className="text-right">Cobrar</TableHead>
              </SiPuede>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cuotas.map((cuota) => {
              const estado = estadoDe(cuota);
              return (
                <TableRow key={cuota.id}>
                  <TableCell>
                    <p className="font-medium">Cuota {cuota.installmentNumber}</p>
                    {cuota.notes && <p className="text-xs text-muted-foreground">{cuota.notes}</p>}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatMoney(Number(cuota.amount))}
                  </TableCell>
                  <TableCell className="text-center">{fechaCorta(cuota.dueDate)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={ESTADO[estado].variant}>{ESTADO[estado].texto}</Badge>
                  </TableCell>
                  <SiPuede permisos={[PERMISO.GESTIONAR_PEDIDOS]}>
                    <TableCell className="text-right">
                      {estado === "pagada" ? (
                        <span className="text-xs text-muted-foreground">Cobrada</span>
                      ) : (
                        <Button type="button" size="sm" variant="outline" onClick={() => abrirCobro(cuota)}>
                          Cobrar
                        </Button>
                      )}
                    </TableCell>
                  </SiPuede>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!cobrando} onOpenChange={(abierto) => !abierto && setCobrando(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cobrar cuota {cobrando?.installmentNumber}</DialogTitle>
            <DialogDescription>
              {cobrando ? `${formatMoney(Number(cobrando.amount))} · vence el ${fechaCorta(cobrando.dueDate)}` : ""}
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="space-y-2 py-2">
              <Label htmlFor="medio-de-pago">Medio de pago</Label>
              <NativeSelect
                id="medio-de-pago"
                value={medio}
                onChange={(e) => setMedio(e.target.value as MedioDePago)}
              >
                {MEDIOS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </DialogBody>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setCobrando(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={cobrar} disabled={pagar.isPending}>
              {pagar.isPending ? "Cobrando…" : "Confirmar cobro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
