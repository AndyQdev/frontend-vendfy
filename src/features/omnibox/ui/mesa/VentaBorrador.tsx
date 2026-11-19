import type { Dispatch } from "react";
import { AlertTriangle, Banknote, CalendarClock, CreditCard, DollarSign, Loader2, QrCode, ShoppingCart, Trash2, Truck, X } from "lucide-react";

import { useDolar } from "@/entities/exchange-rate/api";
import { cuentaEnDolares, FilasDolares, type DolarDelCobro } from "@/entities/exchange-rate/ui/cobro-dolares";
import { cn } from "@/shared/lib/cn";
import { formatDolares } from "@/shared/lib/money";

import { faltaParaCobrar, totalConEnvio, totalVenta, type AccionMesa, type BorradorVenta, type MetodoPago } from "../../model/mesa";
import { BotonCta, FotoProducto, dinero } from "../piezas";
import { SelectorCliente } from "./SelectorCliente";
import { Cantidad } from "./Cantidad";
import { Vacio } from "./PanelMesa";
import { NumeroAnimado } from "../coreografia/NumeroAnimado";

const CAMPO = "h-10 w-full min-w-0 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary";

/** "15", "15,50", "" → número o null. */
const numero = (v: string): number | null => {
  const t = v.replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const TIPOS: { id: "rapida" | "delivery" | "cuotas"; nombre: string }[] = [
  { id: "rapida", nombre: "En el momento" },
  { id: "delivery", nombre: "Con delivery" },
  { id: "cuotas", nombre: "A cuotas" },
];

const METODOS: { id: MetodoPago; nombre: string; icono: typeof Banknote }[] = [
  { id: "efectivo", nombre: "Efectivo", icono: Banknote },
  { id: "qr", nombre: "QR", icono: QrCode },
  { id: "tarjeta", nombre: "Tarjeta", icono: CreditCard },
  { id: "dolares", nombre: "Dólares", icono: DollarSign },
];

/**
 * El dólar del cobro de la venta del asistente: el del día hasta que se
 * escriba otro. Se guarda en el borrador (y no en la pantalla) para que
 * "cobrale en dólares" dicho en el chat cobre con el mismo.
 */
export function useDolarDeVenta(
  storeId: string | undefined,
  venta: Pick<BorradorVenta, "dolar">,
  despachar: Dispatch<AccionMesa>,
): DolarDelCobro & { disponible: boolean } {
  const { data } = useDolar(storeId);
  const delDia = data?.dolar ?? null;
  const aMano = venta.dolar ?? null;
  return {
    valor: aMano ?? delDia?.valor ?? null,
    delDia,
    aMano: aMano !== null && aMano !== delDia?.valor,
    cambiar: (n) => despachar({ tipo: "dolarVenta", dolar: n }),
    volverAlDelDia: () => despachar({ tipo: "dolarVenta", dolar: null }),
    // Cobrar en dólares solo aplica a tiendas en Bs.
    disponible: (data?.moneda ?? "BOB") === "BOB",
  };
}

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
  const dolar = useDolarDeVenta(storeId, venta, despachar);

  if (venta.lineas.length === 0) {
    return (
      <Vacio>
        <ShoppingCart className="mx-auto mb-3 size-8 text-muted-foreground/50" />
        Todavía no hay nada en la venta. Toca un producto en el chat y “Agregar a la venta”.
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
            <li key={l.productId} data-testid="omnibox-linea-venta" data-linea={`venta:${l.productId}`} className="px-3 py-2.5">
              <div className="flex items-center gap-3">
                <span data-linea-foto className="inline-flex shrink-0">
                  <FotoProducto src={l.imagen} className="size-11" />
                </span>
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
                  Pides {l.cantidad} y hay {l.stock} en esta tienda.
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
            {!venta.pago && <span className="ml-1 font-normal">· elige cómo paga</span>}
          </p>
          {/* Dólares solo en la venta en el momento y en tiendas en Bs, como en la Caja. */}
          <div role="radiogroup" aria-label="Método de pago" className="grid grid-cols-2 gap-2">
            {METODOS.filter((m) => m.id !== "dolares" || (dolar.disponible && !venta.entrega && !venta.cuotas)).map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={venta.pago === m.id}
                onClick={() => despachar({ tipo: "pago", pago: m.id })}
                className={cn(
                  "flex h-10 items-center justify-center gap-1.5 rounded-lg border text-[13px] font-semibold transition-colors",
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

      {/* ---- cobrar en dólares: tipo de cambio y cuánto da (el vuelto, en Bs) */}
      {venta.pago === "dolares" && (
        <div data-campo="dolares" className="border-t border-border pt-3">
          <FilasDolares
            total={totalVenta(venta)}
            dolar={dolar}
            usd={venta.recibidoUsd ?? ""}
            onUsd={(v) => despachar({ tipo: "recibidoUsd", recibidoUsd: v })}
          />
        </div>
      )}

      {/* ---- G9f: en el momento, con delivery o a cuotas (como en la Caja) */}
      <div data-campo="tipo-venta" className="space-y-2 border-t border-border pt-3">
        <div role="radiogroup" aria-label="Tipo de venta" className="flex gap-2">
          {TIPOS.map((t) => {
            const activo = t.id === "delivery" ? Boolean(venta.entrega) : t.id === "cuotas" ? Boolean(venta.cuotas) : !venta.entrega && !venta.cuotas;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={activo}
                data-testid={`tipo-venta-${t.id}`}
                onClick={() => despachar({ tipo: "tipoVenta", tipoVenta: t.id })}
                className={cn(
                  "flex h-9 flex-1 items-center justify-center rounded-lg border text-[13px] font-medium transition-colors",
                  activo ? "border-primary bg-primary-soft text-primary" : "border-border bg-card text-muted-foreground hover:border-border-strong",
                )}
              >
                {t.nombre}
              </button>
            );
          })}
        </div>
        {venta.entrega ? (
          <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Truck className="size-3.5" />
                Dirección de entrega
              </span>
              <input
                value={venta.entrega.direccion}
                onChange={(e) => despachar({ tipo: "entrega", entrega: { direccion: e.target.value } })}
                placeholder="Calle, número, zona…"
                aria-label="Dirección de entrega"
                className={cn(CAMPO, !venta.entrega.direccion.trim() && "border-warning")}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted-foreground">Envío (Bs)</span>
              <input
                value={venta.entrega.costo ?? ""}
                onChange={(e) => despachar({ tipo: "entrega", entrega: { costo: numero(e.target.value) } })}
                inputMode="decimal"
                placeholder="A coordinar"
                aria-label="Costo del envío"
                className={cn(CAMPO, "cifra")}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[11px] text-muted-foreground">Notas para la entrega (opcional)</span>
              <input
                value={venta.entrega.notas}
                onChange={(e) => despachar({ tipo: "entrega", entrega: { notas: e.target.value } })}
                placeholder="Tocar el timbre, casa verde…"
                aria-label="Notas para la entrega"
                className={CAMPO}
              />
            </label>
          </div>
        ) : null}
        {venta.cuotas ? (
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                <CalendarClock className="size-3.5" />
                Cuotas
              </span>
              <input
                value={venta.cuotas.cantidad}
                onChange={(e) => despachar({ tipo: "cuotas", cuotas: { cantidad: Math.max(0, Math.round(numero(e.target.value) ?? 0)) } })}
                inputMode="numeric"
                aria-label="Cantidad de cuotas"
                className={cn(CAMPO, "cifra", venta.cuotas.cantidad < 2 && "border-warning")}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted-foreground">Paga hoy (Bs)</span>
              <input
                value={venta.cuotas.inicial ?? ""}
                onChange={(e) => despachar({ tipo: "cuotas", cuotas: { inicial: numero(e.target.value) } })}
                inputMode="decimal"
                placeholder="0,00"
                aria-label="Pago de hoy"
                className={cn(CAMPO, "cifra", venta.cuotas.inicial == null && "border-warning")}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted-foreground">Próximo pago</span>
              <input
                type="date"
                value={venta.cuotas.proxima}
                onChange={(e) => despachar({ tipo: "cuotas", cuotas: { proxima: e.target.value } })}
                aria-label="Fecha del próximo pago"
                className={cn(CAMPO, !venta.cuotas.proxima && "border-warning")}
              />
            </label>
            {venta.cuotas.inicial != null && venta.cuotas.cantidad >= 2 ? (
              <p className="col-span-3 text-xs text-muted-foreground">
                Resta Bs {dinero(Math.max(0, totalVenta(venta) - venta.cuotas.inicial))} en {venta.cuotas.cantidad - 1}{" "}
                {venta.cuotas.cantidad - 1 === 1 ? "cuota" : "cuotas"}.
              </p>
            ) : null}
          </div>
        ) : null}
        {faltaParaCobrar(venta).length ? (
          <p data-testid="venta-falta" className="text-xs text-muted-foreground">
            Falta {faltaParaCobrar(venta).join(", ")}.
          </p>
        ) : null}
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
          <p className="text-xs text-muted-foreground">
            Total{venta.entrega?.costo ? ` (con envío de Bs ${dinero(venta.entrega.costo)})` : ""}
          </p>
          <p data-testid="omnibox-total-venta" className="cifra text-3xl font-bold">
            Bs <NumeroAnimado valor={totalConEnvio(venta)} formato={dinero} />
          </p>
          {venta.pago === "dolares" && cuentaEnDolares(totalVenta(venta), dolar.valor, null).exacto !== null && (
            <p className="cifra text-xs text-muted-foreground">
              {formatDolares(cuentaEnDolares(totalVenta(venta), dolar.valor, null).exacto!)}
            </p>
          )}
        </div>
        <BotonCta
          data-testid="omnibox-cobrar"
          onClick={onCobrar}
          // D3: faltar stock se AVISA en la línea, no bloquea. Un producto
          // "a pedido" se puede vender igual; si no, el servidor lo rechaza
          // con el motivo y se muestra arriba.
          disabled={cobrando || venta.lineas.length === 0 || faltaParaCobrar(venta).length > 0}
          className="h-12 min-w-[12rem] flex-1 text-[15px] sm:flex-none"
        >
          {cobrando ? <Loader2 className="size-5 animate-spin" /> : venta.entrega ? <Truck className="size-5" /> : <CreditCard className="size-5" />}
          {venta.entrega ? (
            <>
              Registrar pedido · Bs <NumeroAnimado valor={totalConEnvio(venta)} formato={dinero} />
            </>
          ) : venta.cuotas ? (
            <>Registrar a cuotas · hoy Bs {dinero(venta.cuotas.inicial ?? 0)}</>
          ) : (
            <>
              Cobrar Bs <NumeroAnimado valor={totalVenta(venta)} formato={dinero} />
            </>
          )}
        </BotonCta>
      </div>
    </div>
  );
}
