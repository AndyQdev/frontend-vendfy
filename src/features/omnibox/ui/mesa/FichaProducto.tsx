import { useEffect, useState, useRef } from "react";
import { Boxes, FileText, Info, ListChecks, ShoppingCart, Truck } from "lucide-react";

import { useFichaProducto } from "@/entities/omnibox/api";
import type { ProductoOpcion } from "@/entities/omnibox/model/types";
import { cn } from "@/shared/lib/cn";

import { costoEnCompra, type BorradorCompra, type TipoMesa } from "../../model/mesa";
import { BotonCta, FotoProducto, dinero, formato } from "../piezas";
import { recordarOrigen } from "../coreografia/animaciones";
import { Cantidad } from "./Cantidad";

/**
 * La ficha del producto, dentro del panel.
 *
 * Es lo que antes era ir a /products/:id y perder la conversación. Acá se mira
 * y se agrega sin salir.
 *
 * Se pinta AL INSTANTE con lo que ya trae la fila del chat (foto, nombre,
 * precio, stock) y se completa cuando llega el detalle: esperar medio segundo
 * mirando un esqueleto para ver datos que ya estaban en pantalla sería peor.
 */
export function FichaProducto({
  producto: base,
  storeId,
  mesa,
  compra,
  onAgregar,
}: {
  producto: ProductoOpcion;
  storeId: string;
  mesa: TipoMesa;
  /** La compra abierta: el costo se precarga y se escribe en su moneda (Bs o dólares). */
  compra?: Pick<BorradorCompra, "moneda" | "dolar">;
  /** En la compra trae el costo (en su moneda) y los anteriores; en la venta, solo la cantidad. */
  onAgregar: (cantidad: number, costo?: number, costoAnterior?: number | null, costoAnteriorUsd?: number | null) => void;
}) {
  const { data: ficha } = useFichaProducto(base.productId, storeId);
  const [cantidad, setCantidad] = useState(1);
  const [foto, setFoto] = useState(0);
  // Al agregar, la ficha se va (el panel pasa a la venta): su foto se anota
  // antes, para que vuele desde acá hasta la línea.
  const fotoRef = useRef<HTMLDivElement>(null);
  const agregar = (...args: Parameters<typeof onAgregar>) => {
    recordarOrigen(base.productId, fotoRef.current);
    onAgregar(...args);
  };
  // El costo se precarga con lo que se pagó la última vez: casi siempre es eso.
  // En una compra en dólares, lo último pagado en dólares (o lo de Bs pasado).
  const enDolares = compra?.moneda === "USD";
  const sugerido = ficha?.costo ? costoEnCompra(compra ?? {}, null, null, ficha.costo).costo : null;
  const costoPrevio = sugerido ? sugerido : null;
  const [costo, setCosto] = useState<string>("");
  useEffect(() => {
    setCosto(costoPrevio != null ? String(costoPrevio) : "");
  }, [base.productId, costoPrevio, enDolares]);
  // Otro producto, otra cuenta: ni la cantidad ni la foto elegida se arrastran.
  useEffect(() => {
    setCantidad(1);
    setFoto(0);
  }, [base.productId]);

  const imagenes = ficha?.imagenes.length ? ficha.imagenes : base.imagen ? [base.imagen] : [];
  const precio = ficha?.precio ?? Number(base.precio);
  const stock = ficha?.stock ?? Number(base.stock);
  const unidad = ficha?.unidad ?? "un";
  const subtitulo = [ficha?.marca, ficha?.categoria].filter(Boolean).join(" · ");
  const especificaciones = Object.entries(ficha?.especificaciones ?? {}).filter(
    ([, v]) => v != null && String(v).trim() !== "",
  );

  return (
    <div data-testid="omnibox-ficha" className="flex min-h-full flex-col">
    <div className="grid flex-1 gap-5 p-4 sm:p-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* ---- fotos */}
      <div className="flex flex-col gap-2">
        <div ref={fotoRef} className="grid aspect-square place-items-center overflow-hidden rounded-xl border border-border bg-white">
          <FotoProducto src={imagenes[foto]} className="size-full rounded-none border-0 object-contain p-3" />
        </div>
        {imagenes.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {imagenes.map((src, i) => (
              <button
                key={src}
                type="button"
                aria-label={`Foto ${i + 1}`}
                aria-pressed={i === foto}
                onClick={() => setFoto(i)}
                className={cn(
                  "size-14 shrink-0 overflow-hidden rounded-lg border-2 bg-white",
                  i === foto ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
                )}
              >
                <img src={src} alt="" className="size-full object-contain" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ---- datos */}
      <div className="flex min-w-0 flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold leading-tight">{ficha?.nombre ?? base.nombre}</h2>
          {(subtitulo || base.codigo) && (
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {subtitulo}
              {subtitulo && (ficha?.codigo ?? base.codigo) && " · "}
              <span className="cifra">{ficha?.codigo ?? base.codigo}</span>
            </p>
          )}
          <p className="cifra mt-2 text-3xl font-bold">Bs {dinero(precio)}</p>
        </div>

        {/* D4: no hay acá pero sí en otra tienda. */}
        {ficha?.aviso && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg bg-info-soft px-3 py-2 text-[13px] font-medium text-info-soft-foreground"
          >
            <Info className="mt-0.5 size-4 shrink-0" />
            {ficha.aviso}
          </p>
        )}

        <Seccion icono={<Boxes className="size-4" />} titulo={ficha && ficha.stockPorTienda.length > 1 ? "Stock por sucursal" : "Stock"}>
          {/* Sin esqueleto: el stock de esta tienda ya vino con la fila del
              chat. El detalle solo suma las otras tiendas. */}
          <ul className="divide-y divide-border">
              {(ficha?.stockPorTienda ?? [{ storeId, nombre: "Esta tienda", stock, esEsta: true }]).map((t) => (
                <li key={t.storeId} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className={cn(t.esEsta && "font-semibold")}>
                    {t.nombre}
                    {t.esEsta && ficha && ficha.stockPorTienda.length > 1 && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">(esta)</span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "cifra font-bold",
                      t.stock <= 0 ? "text-destructive" : t.esEsta ? "text-success-soft-foreground" : "text-foreground",
                    )}
                  >
                    {formato(t.stock)} {unidad}
                  </span>
                </li>
              ))}
          </ul>
        </Seccion>

        {ficha?.descripcion && (
          <Seccion icono={<FileText className="size-4" />} titulo="Notas">
            <p className="max-h-32 overflow-y-auto whitespace-pre-line px-3 py-2.5 text-[13px] leading-relaxed text-muted-foreground">
              {ficha.descripcion}
            </p>
          </Seccion>
        )}

        {especificaciones.length > 0 && (
          <Seccion icono={<ListChecks className="size-4" />} titulo="Especificaciones">
            {/* Dos columnas y tope de alto: un perfume trae doce notas y en una
                sola columna estiraban la ficha hasta perder el botón. */}
            <dl className="grid max-h-52 grid-cols-1 gap-px overflow-y-auto bg-border sm:grid-cols-2">
              {especificaciones.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 bg-card px-3 py-1.5 text-[13px]">
                  <dt className="truncate text-muted-foreground">{k}</dt>
                  <dd className="shrink-0 text-right font-medium">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </Seccion>
        )}

      </div>
    </div>

      {/* Pegada al pie del panel: con una ficha larga (un perfume con doce
          notas) el botón quedaba abajo de todo y había que ir a buscarlo. */}
      {mesa === "compra" && (
        <div className="sticky bottom-0 z-10 space-y-2 border-t border-border bg-card px-4 py-3 sm:px-5">
          {ficha?.costo?.ultimoCosto != null && (
            <p className="cifra text-xs text-muted-foreground">
              La última vez lo pagaste{" "}
              {enDolares && ficha.costo.ultimoCostoUsd != null
                ? `$us ${dinero(ficha.costo.ultimoCostoUsd)}`
                : `Bs ${dinero(ficha.costo.ultimoCosto)}`}
              {ficha.costo.ultimoProveedor ? ` a ${ficha.costo.ultimoProveedor}` : ""}
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Cantidad</p>
              <Cantidad valor={cantidad} onCambio={(v) => setCantidad(Math.max(1, v))} />
            </div>
            <label>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Costo c/u ({enDolares ? "$us" : "Bs"})</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                aria-label="Costo por unidad"
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
                className="cifra h-11 w-28 rounded-lg border border-border bg-card px-3 text-base md:text-sm font-semibold outline-none focus:border-primary"
              />
            </label>
            <BotonCta
              data-testid="omnibox-agregar-compra"
              className="h-11 flex-1"
              onClick={() => agregar(cantidad, Number(costo) || 0, ficha?.costo?.ultimoCosto ?? null, ficha?.costo?.ultimoCostoUsd ?? null)}
            >
              <Truck className="size-4" />
              Agregar a la compra
            </BotonCta>
          </div>
        </div>
      )}

      {mesa === "venta" && (
        <div className="sticky bottom-0 z-10 flex items-end gap-3 border-t border-border bg-card px-4 py-3 sm:px-5">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Cantidad</p>
            <Cantidad valor={cantidad} onCambio={(v) => setCantidad(Math.max(1, v))} />
          </div>
          <BotonCta
            data-testid="omnibox-agregar-venta"
            className="h-11 flex-1"
            onClick={() => agregar(cantidad)}
          >
            <ShoppingCart className="size-4" />
            Agregar a la venta
          </BotonCta>
        </div>
      )}
    </div>
  );
}

function Seccion({
  icono,
  titulo,
  children,
}: {
  icono: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border">
      <h3 className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-[13px] font-semibold">
        <span className="text-muted-foreground">{icono}</span>
        {titulo}
      </h3>
      {children}
    </section>
  );
}
