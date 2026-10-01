import type { Dispatch } from "react";
import { AlertTriangle, Banknote, CreditCard, Loader2, QrCode, ShoppingCart, Trash2, X } from "lucide-react";

import { cn } from "@/shared/lib/cn";

import { totalVenta, type AccionMesa, type BorradorVenta, type MetodoPago } from "../../model/mesa";
import { BotonCta, FotoProducto, dinero } from "../piezas";
import { SelectorCliente } from "./SelectorCliente";
import { Cantidad } from "./Cantidad";
import { Vacio } from "./PanelMesa";

const METODOS: { id: MetodoPago; nombre: string; icono: typeof Banknote }[] = [
  { id: "efectivo", nombre: "Efectivo", icono: Banknote },
  { id: "qr", nombre: "QR", icono: QrCode },
  { id: "tarjeta", nombre: "Tarjeta", icono: CreditCard },
];

/**
 * La venta que se va armando: líneas, cliente, método de pago y Cobrar.
 *
 * Todo lo que cambia acá pasa por el reductor de la mesa, igual que lo que
 * llegue hablando (Fase 3): no hay estado propio que pueda desincronizarse.
 */
export function VentaBorrador({
  venta,
  despachar,
  storeId,
  onCobrar,
  cobrando,
  error,
}: {
  venta: BorradorVenta;
  despachar: Dispatch<AccionMesa>;
  storeId: string;
  onCobrar: () => void;
  cobrando: boolean;
  /** Lo que respondió el servidor si no se pudo cobrar (stock, permisos…). */
  error: string | null;
}) {
  if (venta.lineas.length === 0) {
    return (
      <Vacio>
        <ShoppingCart className="mx-auto mb-3 size-8 text-muted-foreground/50" />
        Todavía no hay nada en la venta. Tocá un producto en el chat y “Agregar a la venta”.
      </Vacio>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">
          {venta.lineas.length} {venta.lineas.length === 1 ? "producto" : "productos"}
        </p>
        <button
          type="button"
          onClick={() => despachar({ tipo: "limpiarVenta" })}
          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <Trash2 className="size-4" />
          Limpiar
        </button>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {venta.lineas.map((l) => {
          const falta = l.cantidad > l.stock;
          const controles = (
            <>
              <span data-campo={`cantidad:${l.productId}`} className="inline-flex">
                <Cantidad
                  compacta
                  minimo={0}
                  valor={l.cantidad}
                  etiqueta={`Cantidad de ${l.nombre}`}
                  onCambio={(v) => despachar({ tipo: "cantidadVenta", productId: l.productId, cantidad: v })}
                />
              </span>
              <p className="cifra w-24 text-right text-sm font-semibold">Bs {dinero(l.precio * l.cantidad)}</p>
            </>
          );
          return (
            <li key={l.productId} data-testid="omnibox-linea-venta" className="px-3 py-2.5">
              <div className="flex items-center gap-3">
                <FotoProducto src={l.imagen} className="size-11" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{l.nombre}</p>
                  <p className="cifra text-xs text-muted-foreground">Bs {dinero(l.precio)} c/u</p>
                </div>
                <div className="hidden items-center gap-3 sm:flex">{controles}</div>
                <button
                  type="button"
                  aria-label={`Quitar ${l.nombre}`}
                  onClick={() => despachar({ tipo: "quitarVenta", productId: l.productId })}
                  className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
              {/* En el teléfono la cantidad baja a su renglón: al lado del
                  nombre lo recortaba a "Aceite vege…". */}
              <div className="mt-2 flex items-center justify-between pl-14 sm:hidden">{controles}</div>
              {/* D3: se avisa en la línea, donde está el problema. */}
              {falta && (
                <p
                  role="alert"
                  className={cn(
                    "mt-2 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
                    "bg-warning-soft text-warning-soft-foreground",
                  )}
                >
                  <AlertTriangle className="size-3.5 shrink-0" />
                  Pedís {l.cantidad} y hay {l.stock} en esta tienda.
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {/* ---- cliente y pago */}
      <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
        <div data-campo="cliente">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Cliente</p>
          <SelectorCliente
            storeId={storeId}
            clienteId={venta.clienteId}
            nombre={venta.clienteNombre}
            onElegir={(id, nombre) => despachar({ tipo: "cliente", clienteId: id, nombre })}
          />
        </div>
        <div data-campo="pago">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Método de pago
            {!venta.pago && <span className="ml-1 font-normal">· elegí cómo paga</span>}
          </p>
          <div role="radiogroup" aria-label="Método de pago" className="flex gap-2">
            {METODOS.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={venta.pago === m.id}
                onClick={() => despachar({ tipo: "pago", pago: m.id })}
                className={cn(
                  "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border text-[13px] font-semibold transition-colors",
                  venta.pago === m.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-border-strong",
                )}
              >
                <m.icono className="size-4" />
                {m.nombre}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lo que dijo el servidor, donde se va a leer: al lado del botón. */}
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-[13px] font-medium text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {/* ---- total y cobrar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <div>
          <p className="text-xs text-muted-foreground">Total</p>
          <p data-testid="omnibox-total-venta" className="cifra text-3xl font-bold">
            Bs {dinero(totalVenta(venta))}
          </p>
        </div>
        <BotonCta
          data-testid="omnibox-cobrar"
          onClick={onCobrar}
          // D3: faltar stock se AVISA en la línea, no bloquea. Un producto
          // "a pedido" se puede vender igual; si no, el servidor lo rechaza
          // con el motivo y se muestra arriba.
          disabled={cobrando || venta.lineas.length === 0}
          className="h-12 min-w-[12rem] flex-1 text-[15px] sm:flex-none"
        >
          {cobrando ? <Loader2 className="size-5 animate-spin" /> : <CreditCard className="size-5" />}
          Cobrar Bs {dinero(totalVenta(venta))}
        </BotonCta>
      </div>
    </div>
  );
}
