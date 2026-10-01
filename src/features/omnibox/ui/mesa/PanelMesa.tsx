import type { Dispatch, ReactNode } from "react";
import { Maximize2, Minimize2, Package, ShoppingCart, Truck, X } from "lucide-react";

import { cn } from "@/shared/lib/cn";

import { unidades, type AccionMesa, type Mesa } from "../../model/mesa";
import { FotoProducto } from "../piezas";
import { FichaProducto } from "./FichaProducto";
import { VentaBorrador } from "./VentaBorrador";
import { CompraBorrador } from "./CompraBorrador";

/**
 * La mesa de trabajo: el panel de la derecha.
 *
 * Cabecera (qué se está mirando, ampliar, cerrar), dos pestañas —el producto y
 * lo que se está armando— y el cuerpo con su propio scroll. El mismo
 * componente va en la columna derecha del escritorio y en la hoja que sube
 * desde abajo en el teléfono: cambia el marco, no el contenido.
 */
export function PanelMesa({
  mesa,
  despachar,
  storeId,
  enHoja = false,
  onCobrar,
  cobrando = false,
  errorCobro = null,
  onRegistrarCompra,
  registrando = false,
  errorCompra = null,
}: {
  mesa: Mesa;
  despachar: Dispatch<AccionMesa>;
  storeId: string;
  onCobrar: () => void;
  cobrando?: boolean;
  errorCobro?: string | null;
  onRegistrarCompra: () => void;
  registrando?: boolean;
  errorCompra?: string | null;
  /** Dentro de la hoja del teléfono: sin borde ni botón de ampliar. */
  enHoja?: boolean;
}) {
  if (!mesa.abierta) return null;

  const esVenta = mesa.abierta === "venta";
  const lineas = esVenta ? mesa.venta.lineas : mesa.compra.lineas;
  const verProducto = mesa.pestana === "producto" && mesa.producto;

  return (
    <aside
      data-testid="omnibox-mesa"
      data-mesa={mesa.abierta}
      aria-label={esVenta ? "Venta" : "Compra"}
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden bg-card",
        !enHoja && "rounded-xl border border-border shadow-card",
      )}
    >
      {/* ---- cabecera */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        {verProducto ? (
          <>
            <FotoProducto src={mesa.producto!.imagen} className="size-11" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold leading-tight">{mesa.producto!.nombre}</p>
              {mesa.producto!.codigo && (
                <p className="cifra truncate text-xs text-muted-foreground">{mesa.producto!.codigo}</p>
              )}
            </div>
          </>
        ) : (
          <>
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
              {esVenta ? <ShoppingCart className="size-5" /> : <Truck className="size-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight">{esVenta ? "Venta" : "Compra"}</p>
              <p className="text-xs text-muted-foreground">
                {lineas.length === 0
                  ? "Todavía no agregaste nada"
                  : `${lineas.length} ${lineas.length === 1 ? "producto" : "productos"} · ${unidades(lineas)} un`}
              </p>
            </div>
          </>
        )}

        {!enHoja && (
          <BotonIcono
            etiqueta={mesa.ampliada ? "Achicar el panel" : "Ampliar el panel"}
            onClick={() => despachar({ tipo: "ampliar" })}
          >
            {mesa.ampliada ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </BotonIcono>
        )}
        <BotonIcono etiqueta="Cerrar el panel" onClick={() => despachar({ tipo: "cerrar" })}>
          <X className="size-4" />
        </BotonIcono>
      </header>

      {/* ---- pestañas: el producto, la venta y la compra. Tocar Venta o
          Compra cambia de mesa sin perder la otra (queda en el chip). */}
      <div role="tablist" className="flex border-b border-border px-2">
        <Pestana
          activa={mesa.pestana === "producto"}
          onClick={() => despachar({ tipo: "pestana", pestana: "producto" })}
          icono={<Package className="size-4" />}
        >
          Producto
        </Pestana>
        <Pestana
          destino="venta"
          activa={mesa.pestana === "borrador" && esVenta}
          onClick={() => despachar({ tipo: "abrir", mesa: "venta", pestana: "borrador" })}
          icono={<ShoppingCart className="size-4" />}
        >
          Venta
          <Cuenta n={mesa.venta.lineas.length} />
        </Pestana>
        <Pestana
          destino="compra"
          activa={mesa.pestana === "borrador" && !esVenta}
          onClick={() => despachar({ tipo: "abrir", mesa: "compra", pestana: "borrador" })}
          icono={<Truck className="size-4" />}
        >
          Compra
          <Cuenta n={mesa.compra.lineas.length} />
        </Pestana>
      </div>

      {/* ---- cuerpo */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {mesa.pestana === "producto" ? (
          mesa.producto ? (
            <FichaProducto
              producto={mesa.producto}
              storeId={storeId}
              mesa={mesa.abierta}
              onAgregar={(cantidad, costo, costoAnterior) => {
                if (esVenta) {
                  despachar({ tipo: "agregarVenta", producto: mesa.producto!, cantidad });
                } else {
                  despachar({
                    tipo: "agregarCompra",
                    producto: mesa.producto!,
                    cantidad,
                    costo: costo ?? 0,
                    costoAnterior: costoAnterior ?? null,
                  });
                }
                // Directo a lo que se está armando: se ve que entró y el total,
                // sin tener que adivinar que hay que tocar la otra pestaña.
                despachar({ tipo: "pestana", pestana: "borrador" });
              }}
            />
          ) : (
            <Vacio>Tocá un producto en el chat para verlo acá.</Vacio>
          )
        ) : esVenta ? (
          <VentaBorrador
            venta={mesa.venta}
            despachar={despachar}
            storeId={storeId}
            onCobrar={onCobrar}
            cobrando={cobrando}
            error={errorCobro}
          />
        ) : (
          <CompraBorrador
            compra={mesa.compra}
            despachar={despachar}
            onRegistrar={onRegistrarCompra}
            registrando={registrando}
            error={errorCompra}
          />
        )}
      </div>
    </aside>
  );
}

function BotonIcono({
  etiqueta,
  onClick,
  children,
}: {
  etiqueta: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      onClick={onClick}
      className="grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-border-strong hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

function Pestana({
  activa,
  onClick,
  icono,
  children,
  destino,
}: {
  /** Marca para la coreografía: lo que entra a esta mesa vuela hasta acá si la línea no está a la vista. */
  destino?: "venta" | "compra";
  activa: boolean;
  onClick: () => void;
  icono: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activa}
      data-pestana={destino}
      onClick={onClick}
      className={cn(
        "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
        activa
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {icono}
      {children}
    </button>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="px-6 py-16 text-center text-sm text-muted-foreground">{children}</p>;
}

function Cuenta({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <span className="cifra ml-1.5 rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
      {n}
    </span>
  );
}
