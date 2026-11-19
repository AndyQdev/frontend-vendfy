import { useEffect, useState, type Dispatch } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, FileText, Loader2, PackageCheck, Trash2, Truck, X } from "lucide-react";

import { useDolar } from "@/entities/exchange-rate/api";
import { LineaDolar, SelectorMoneda } from "@/entities/exchange-rate/ui/dolar";
import { cn } from "@/shared/lib/cn";
import { formatDolar } from "@/shared/lib/money";

import { totalCompra, totalCompraBs, type AccionMesa, type BorradorCompra } from "../../model/mesa";
import { BotonCta, BotonSecundario, FotoProducto, dinero } from "../piezas";
import { Cantidad } from "./Cantidad";
import { Vacio } from "./PanelMesa";
import { NumeroAnimado } from "../coreografia/NumeroAnimado";

/**
 * La compra que se va armando: lo que llegó, a cuánto, de quién.
 *
 * Cada línea muestra el costo anterior al lado del nuevo: si el proveedor
 * subió el precio, se nota antes de registrar, no a fin de mes.
 *
 * "Registrar compra" pide una segunda confirmación ahí mismo: una compra
 * recibida sube el stock, mueve el costo promedio y NO se puede anular.
 *
 * En dólares (el proveedor cotizó en dólares) los costos se escriben en
 * dólares y el servidor los pasa a Bs con el dólar de la compra, como en
 * Nueva compra.
 */
export function CompraBorrador({
  compra,
  despachar,
  storeId,
  onRegistrar,
  registrando,
  error,
}: {
  compra: BorradorCompra;
  despachar: Dispatch<AccionMesa>;
  storeId: string;
  onRegistrar: () => void;
  registrando: boolean;
  error: string | null;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const { data: dolarDia } = useDolar(storeId);
  const delDia = dolarDia?.dolar ?? null;
  const moneda = compra.moneda ?? "BOB";
  const enDolares = moneda === "USD";
  const dolar = compra.dolar ?? delDia?.valor ?? null;
  const signo = enDolares ? "$us" : "Bs";

  // Una compra que pasó a dólares (una factura en dólares, "a 8 dólares")
  // antes de que llegara el dólar del día: se fija con el de hoy.
  useEffect(() => {
    if (enDolares && compra.dolar == null && delDia) despachar({ tipo: "dolarCompra", dolar: delDia.valor });
  }, [enDolares, compra.dolar, delDia, despachar]);

  const porResolver = compra.porResolver.length;

  if (compra.lineas.length === 0 && porResolver === 0) {
    return (
      <Vacio>
        <Truck className="mx-auto mb-3 size-8 text-muted-foreground/50" />
        Todavía no cargaste nada. Di “compré 10 cocas a 11”, sácale una foto a la factura o toca un producto y
        “Agregar a la compra”.
      </Vacio>
    );
  }

  const total = totalCompra(compra);
  const totalBs = totalCompraBs(compra, dolar);
  const sinCosto = compra.lineas.filter((l) => !(l.costo > 0));
  const aBs = (n: number) => (dolar ? Math.round(n * dolar * 100) / 100 : null);

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">
          {compra.lineas.length} {compra.lineas.length === 1 ? "producto" : "productos"}
        </p>
        <button
          type="button"
          onClick={() => despachar({ tipo: "limpiarCompra" })}
          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <Trash2 className="size-4" />
          Limpiar
        </button>
      </div>

      {/* ---- la moneda: Bs, o dólares si el proveedor cotizó en dólares */}
      {(dolarDia?.moneda ?? "BOB") === "BOB" && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-campo="moneda" data-testid="omnibox-moneda-compra">
          <SelectorMoneda
            valor={moneda}
            etiqueta="Moneda de la compra"
            onCambio={(m) => despachar({ tipo: "monedaCompra", moneda: m, dolar })}
          />
          {enDolares && (
            <LineaDolar
              valor={dolar}
              delDia={delDia}
              aMano={compra.dolar != null && compra.dolar !== delDia?.valor}
              onCambio={(n) => despachar({ tipo: "dolarCompra", dolar: n })}
              onVolver={() => despachar({ tipo: "dolarCompra", dolar: delDia?.valor ?? null })}
            />
          )}
        </div>
      )}

      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {compra.lineas.map((l) => {
          // Se compara en la moneda de la compra: en dólares, con lo último
          // pagado en dólares; si nunca se compró en dólares, se muestra lo
          // pagado en Bs, sin flecha (no son comparables).
          const antes = enDolares ? (l.costoAnteriorUsd ?? null) : l.costoAnterior;
          const antesTexto =
            antes != null
              ? `${signo} ${dinero(antes)}`
              : enDolares && l.costoAnterior != null
                ? `Bs ${dinero(l.costoAnterior)}`
                : null;
          const subio = antes != null && l.costo > antes;
          const bajo = antes != null && l.costo < antes;
          return (
            <li key={l.productId} data-testid="omnibox-linea-compra" data-linea={`compra:${l.productId}`} className="space-y-2 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <span data-linea-foto className="inline-flex shrink-0">
                  <FotoProducto src={l.imagen} className="size-11" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{l.nombre}</p>
                  {antesTexto != null ? (
                    <p
                      className={cn(
                        "cifra flex items-center gap-1 text-xs",
                        subio ? "text-warning-soft-foreground" : bajo ? "text-success-soft-foreground" : "text-muted-foreground",
                      )}
                    >
                      {subio && <ArrowUp className="size-3" />}
                      {bajo && <ArrowDown className="size-3" />}
                      La última vez: {antesTexto}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Primera compra de este producto</p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`Quitar ${l.nombre}`}
                  onClick={() => despachar({ tipo: "quitarCompra", productId: l.productId })}
                  className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 pl-14">
                <span data-campo={`cantidad:${l.productId}`} className="inline-flex">
                  <Cantidad
                    compacta
                    minimo={0}
                    valor={l.cantidad}
                    etiqueta={`Cantidad de ${l.nombre}`}
                    onCambio={(v) => despachar({ tipo: "cantidadCompra", productId: l.productId, cantidad: v })}
                  />
                </span>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  a
                  <span className="relative" data-campo={`costo:${l.productId}`}>
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs">{signo}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      aria-label={`Costo de ${l.nombre}${enDolares ? " en dólares" : ""}`}
                      value={l.costo}
                      onChange={(e) =>
                        despachar({ tipo: "costoCompra", productId: l.productId, costo: Number(e.target.value) })
                      }
                      className={cn(
                        "cifra h-9 w-28 rounded-lg border bg-card pr-2 text-base md:text-sm font-semibold text-foreground outline-none focus:border-primary",
                        enDolares ? "pl-10" : "pl-8",
                        !(l.costo > 0) ? "border-warning" : "border-border",
                      )}
                    />
                  </span>
                  c/u
                </label>
                <p className="cifra ml-auto text-right text-sm font-semibold">
                  {signo} {dinero(l.costo * l.cantidad)}
                  {enDolares && aBs(l.costo * l.cantidad) != null && (
                    <span className="block text-xs font-normal text-muted-foreground">≈ Bs {dinero(aBs(l.costo * l.cantidad)!)}</span>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {/* ---- proveedor y factura */}
      <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
        <Campo
          campo="proveedor"
          etiqueta="Proveedor"
          valor={compra.proveedor}
          placeholder="Distribuidora, marca…"
          onCambio={(v) => despachar({ tipo: "proveedor", proveedor: v })}
        />
        <Campo
          campo="referencia"
          etiqueta="N° de factura o remito"
          valor={compra.referencia}
          placeholder="Opcional"
          onCambio={(v) => despachar({ tipo: "referencia", referencia: v })}
        />
      </div>

      {/* ---- la factura de donde salió: la foto, para comparar con el papel */}
      {compra.adjunto && (
        <a
          href={compra.adjunto}
          target="_blank"
          rel="noreferrer"
          data-testid="omnibox-adjunto-compra"
          className="flex items-center gap-3 rounded-lg border border-border p-2 hover:bg-muted/60"
        >
          {/\.pdf($|\?)/i.test(compra.adjunto) ? (
            <FileText className="size-10 shrink-0 text-primary" />
          ) : (
            <img src={compra.adjunto} alt="Factura" className="size-12 shrink-0 rounded-md border border-border object-cover" />
          )}
          <span className="text-[13px]">
            <span className="block font-semibold">Factura adjunta</span>
            <span className="text-muted-foreground">Queda guardada con la compra · toca para verla</span>
          </span>
        </a>
      )}

      {porResolver > 0 && (
        <p
          data-testid="omnibox-compra-por-resolver"
          className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-[13px] font-medium text-warning-soft-foreground"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Falta{porResolver === 1 ? "" : "n"} {porResolver} {porResolver === 1 ? "renglón" : "renglones"} de la factura:
          elige el producto, créalo o descártalo en el chat. Hasta entonces no se puede registrar.
        </p>
      )}

      {sinCosto.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-[13px] font-medium text-warning-soft-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {sinCosto.length === 1 ? `${sinCosto[0].nombre} no tiene costo` : `${sinCosto.length} productos no tienen costo`}:
          sin él, la ganancia de esas ventas va a salir mal.
        </p>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-[13px] font-medium text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {/* ---- total y registrar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <div>
          <p className="text-xs text-muted-foreground">Total de la compra</p>
          <p data-testid="omnibox-total-compra" className="cifra text-3xl font-bold">
            {signo} <NumeroAnimado valor={total} formato={dinero} />
          </p>
          {enDolares && (
            <p className="cifra text-xs text-muted-foreground" data-testid="omnibox-total-compra-bs">
              {totalBs != null && dolar
                ? `= Bs ${dinero(totalBs)} al dólar de ${formatDolar(dolar)}`
                : "Escribe el dólar para ver cuánto es en Bs"}
            </p>
          )}
        </div>
        {confirmando ? (
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:flex-none">
            <p className="w-full text-right text-xs text-muted-foreground sm:w-auto">
              Sube el stock y no se puede anular.
            </p>
            <BotonSecundario onClick={() => setConfirmando(false)} disabled={registrando} className="h-11">
              No
            </BotonSecundario>
            <BotonCta
              data-testid="omnibox-confirmar-compra"
              onClick={() => {
                onRegistrar();
                setConfirmando(false);
              }}
              disabled={registrando}
              className="h-11"
            >
              {registrando ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />}
              Sí, registrar
            </BotonCta>
          </div>
        ) : (
          <BotonCta
            data-testid="omnibox-registrar-compra"
            onClick={() => setConfirmando(true)}
            disabled={registrando || porResolver > 0 || compra.lineas.length === 0}
            className="h-12 min-w-[12rem] flex-1 text-[15px] sm:flex-none"
          >
            {registrando ? <Loader2 className="size-5 animate-spin" /> : <PackageCheck className="size-5" />}
            Registrar compra
          </BotonCta>
        )}
      </div>
    </div>
  );
}

function Campo({
  campo,
  etiqueta,
  valor,
  placeholder,
  onCambio,
}: {
  campo: string;
  etiqueta: string;
  valor: string;
  placeholder: string;
  onCambio: (v: string) => void;
}) {
  return (
    <label className="block" data-campo={campo}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{etiqueta}</span>
      <input
        value={valor}
        placeholder={placeholder}
        onChange={(e) => onCambio(e.target.value)}
        className="h-11 w-full rounded-lg border border-border bg-card px-3 text-base md:text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
      />
    </label>
  );
}
