import { useState, type FormEvent } from "react";
import { AlertTriangle, Check, FileText, Loader2, PackagePlus, Search, X } from "lucide-react";
import { toast } from "sonner";

import { useCrearProductoRapido } from "@/entities/omnibox/api";
import type { ItemPedido, ProductoOpcion, Propuesta } from "@/entities/omnibox/model/types";
import { cn } from "@/shared/lib/cn";

import { ElegirProducto } from "../ElegirProducto";
import { BotonCta, Cabecera, FotoProducto, Tarjeta, dinero } from "../piezas";

/**
 * La factura del proveedor, leída de una foto (Fase 5).
 *
 * Cada renglón tiene uno de tres estados, y se ve cuál a primera vista:
 *   - **reconocido**: ya está cargado a la derecha, con el costo de la factura;
 *   - **dudoso**: se parece a varios productos, se toca el que es;
 *   - **nuevo**: no está en el catálogo, se crea ahí mismo con el nombre y el
 *     costo de la factura, o se descarta si no es algo que se venda.
 *
 * Mientras quede un renglón sin resolver, la compra no se registra.
 */
export function TarjetaFactura({
  propuesta: p,
  storeId,
  hora,
  onElegirItem,
  onOmitirItem,
}: {
  propuesta: Propuesta;
  storeId: string;
  hora: string;
  onElegirItem: (indice: number, producto: ProductoOpcion) => void;
  onOmitirItem: (indice: number) => void;
}) {
  const e = p.entidades as Record<string, any>;
  const items = p.items ?? [];
  const resuelto = (it: ItemPedido) => Boolean(it.producto || it.agregados?.length || it.omitido);
  const pendientes = items.filter((it) => !resuelto(it)).length;
  const reconocidos = items.filter((it) => it.producto).length;
  // Si la suma de los renglones no da el total impreso, algo se leyó mal: una
  // cantidad, un costo, un renglón que no se vio.
  const noCierra =
    e.totalImpreso != null && e.suma != null && Math.abs(Number(e.totalImpreso) - Number(e.suma)) > 0.5;

  return (
    <Tarjeta estado={pendientes ? "factura" : "factura-lista"} hora={hora}>
      <Cabecera icono={FileText}>
        {e.proveedor ? `Factura de ${e.proveedor}` : "Factura del proveedor"}
        {e.referencia ? ` · Nº ${e.referencia}` : ""}
      </Cabecera>

      <p className="mb-3 text-[13px] text-muted-foreground sm:pl-11">
        {items.length} {items.length === 1 ? "renglón" : "renglones"} · {reconocidos} reconocido
        {reconocidos === 1 ? "" : "s"} y cargado{reconocidos === 1 ? "" : "s"} a la compra
        {pendientes > 0 && (
          <span className="font-semibold text-foreground">
            {" "}
            · falta{pendientes === 1 ? "" : "n"} {pendientes} por resolver
          </span>
        )}
        {e.adjunto && (
          <>
            {" · "}
            <a href={e.adjunto} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
              ver la foto
            </a>
          </>
        )}
      </p>

      {noCierra && (
        <p className="mb-3 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-[13px] font-medium text-warning-soft-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          La suma de los renglones (Bs {dinero(Number(e.suma))}) no da el total de la factura (Bs{" "}
          {dinero(Number(e.totalImpreso))}). Revisá cantidades y costos antes de registrar.
        </p>
      )}

      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {items.map((it, i) => (
          <li
            key={i}
            data-testid="omnibox-renglon-factura"
            data-estado={it.producto ? "reconocido" : it.omitido ? "omitido" : it.agregados?.length ? "resuelto" : it.opciones.length ? "dudoso" : "nuevo"}
            className="px-3 py-2.5"
          >
            {it.producto ? (
              <Resuelto imagen={it.producto.imagen} leido={it.texto}>
                {it.cantidad} × {it.producto.nombre}
                <Costo it={it} />
              </Resuelto>
            ) : it.omitido ? (
              <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <X className="size-4 shrink-0" />
                <span className="truncate line-through">{it.texto}</span>
                <span className="shrink-0">· no se carga</span>
              </p>
            ) : it.agregados?.length ? (
              <Resuelto imagen={undefined} leido={it.texto}>
                Cargado a la compra
                <Costo it={it} />
              </Resuelto>
            ) : (
              <RenglonPendiente
                item={it}
                storeId={storeId}
                onElegir={(o) => onElegirItem(i, o)}
                onOmitir={() => onOmitirItem(i)}
              />
            )}
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

function Costo({ it }: { it: ItemPedido }) {
  if (it.precio == null) return null;
  return <span className="cifra ml-1.5 text-xs text-muted-foreground">a Bs {dinero(it.precio)} c/u</span>;
}

function Resuelto({
  imagen,
  leido,
  children,
}: {
  imagen: string | null | undefined;
  leido: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-success text-success-foreground">
        <Check className="size-3.5" strokeWidth={3} />
      </span>
      {imagen !== undefined && <FotoProducto src={imagen} className="size-8" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{children}</p>
        {/* Lo que decía el papel: para ver de un vistazo que se leyó bien. */}
        <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{leido}</p>
      </div>
    </div>
  );
}

/** Un renglón dudoso o nuevo: elegir, crear, buscar con otro nombre o descartar. */
function RenglonPendiente({
  item: it,
  storeId,
  onElegir,
  onOmitir,
}: {
  item: ItemPedido;
  storeId: string;
  onElegir: (o: ProductoOpcion) => void;
  onOmitir: () => void;
}) {
  const dudoso = it.opciones.length > 0;
  const [modo, setModo] = useState<"elegir" | "crear" | "buscar">(dudoso ? "elegir" : "crear");

  return (
    <div className="space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold uppercase tracking-wide">{it.texto}</p>
          <p className="cifra text-xs text-muted-foreground">
            {it.cantidad} {it.precio != null ? `a Bs ${dinero(it.precio)} c/u` : "sin costo en la factura"} ·{" "}
            <span className={dudoso ? "text-foreground" : "text-warning-soft-foreground"}>
              {dudoso ? "¿cuál de estos es?" : "no está en tu catálogo"}
            </span>
          </p>
        </div>
      </div>

      {modo === "elegir" && (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {it.opciones.map((o) => (
            <button
              key={o.productId}
              type="button"
              data-testid="omnibox-opcion-factura"
              onClick={() => onElegir(o)}
              className="flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-2 text-left transition-colors hover:bg-muted/60"
            >
              <FotoProducto src={o.imagen} className="size-9" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">{o.nombre}</span>
                <span className="cifra text-[11px] text-muted-foreground">
                  {Number(o.stock)} en stock · se vende a Bs {dinero(Number(o.precio))}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {modo === "crear" && (
        <CrearProducto
          nombreInicial={titular(it.texto)}
          costo={it.precio}
          storeId={storeId}
          onCreado={onElegir}
        />
      )}

      {modo === "buscar" && <ElegirProducto storeId={storeId} textoInicial="" onElegir={onElegir} />}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
        {dudoso && modo !== "elegir" && (
          <Enlace onClick={() => setModo("elegir")}>Ver los parecidos</Enlace>
        )}
        {modo !== "crear" && (
          <Enlace data-testid="omnibox-crear-desde-factura" onClick={() => setModo("crear")}>
            <PackagePlus className="size-3.5" />
            Es nuevo: crearlo
          </Enlace>
        )}
        {modo !== "buscar" && (
          <Enlace onClick={() => setModo("buscar")}>
            <Search className="size-3.5" />
            Buscar con otro nombre
          </Enlace>
        )}
        <Enlace data-testid="omnibox-omitir-renglon" onClick={onOmitir} className="text-muted-foreground">
          <X className="size-3.5" />
          No cargar este renglón
        </Enlace>
      </div>
    </div>
  );
}

/**
 * Alta rápida: nombre y precio de venta, nada más. El costo ya lo trae la
 * factura. Fotos, categoría y el resto se completan después en Productos:
 * pedirlos acá es frenar la carga de la compra por algo que puede esperar.
 */
function CrearProducto({
  nombreInicial,
  costo,
  storeId,
  onCreado,
}: {
  nombreInicial: string;
  costo: number | null;
  storeId: string;
  onCreado: (o: ProductoOpcion) => void;
}) {
  const crear = useCrearProductoRapido();
  const [nombre, setNombre] = useState(nombreInicial);
  const [precio, setPrecio] = useState("");
  const valido = nombre.trim().length > 1 && Number(precio) > 0;
  const bajoCosto = costo != null && Number(precio) > 0 && Number(precio) <= costo;

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    if (!valido) return;
    try {
      const p = await crear.mutateAsync({ storeId, nombre: nombre.trim(), precio: Number(precio) });
      onCreado({
        storeProductId: "",
        productId: p.id,
        nombre: p.name ?? nombre.trim(),
        codigo: null,
        imagen: null,
        precio: Number(precio),
        stock: 0,
        similitud: 1,
      });
    } catch (error: any) {
      toast.error(error?.message ?? "No se pudo crear el producto");
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-2 rounded-lg border border-dashed border-border p-2.5">
      <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Nombre del producto</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            aria-label="Nombre del producto nuevo"
            className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Precio de venta (Bs)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            aria-label="Precio de venta del producto nuevo"
            placeholder={costo != null ? `más de ${dinero(costo)}` : "0,00"}
            className={cn(
              "cifra h-10 w-full rounded-lg border bg-card px-3 text-sm font-semibold outline-none focus:border-primary",
              bajoCosto ? "border-warning" : "border-border",
            )}
          />
        </label>
      </div>
      {bajoCosto && (
        <p className="text-xs font-medium text-warning-soft-foreground">
          Lo vendés a lo mismo o menos de lo que te costó (Bs {dinero(costo!)}).
        </p>
      )}
      <BotonCta type="submit" data-testid="omnibox-crear-producto-factura" disabled={!valido || crear.isPending} className="w-full sm:w-auto">
        {crear.isPending ? <Loader2 className="size-4 animate-spin" /> : <PackagePlus className="size-4" />}
        Crear y cargar a la compra
      </BotonCta>
    </form>
  );
}

function Enlace({ className, children, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className={cn("inline-flex items-center gap-1 font-medium text-primary hover:underline", className)}
    >
      {children}
    </button>
  );
}

/** "GALLETAS MARIA 200G" → "Galletas Maria 200g": las facturas vienen en mayúsculas. */
function titular(t: string): string {
  return t
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
