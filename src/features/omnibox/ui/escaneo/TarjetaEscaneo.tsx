import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Info,
  Loader2,
  PackagePlus,
  RotateCcw,
  ScanBarcode,
  ShoppingCart,
  Sparkles,
  Truck,
  X,
} from "lucide-react";

import { useBrands, useCategories } from "@/entities/product/api";
import { useEnriquecimientoIa } from "@/features/scanner";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { cn } from "@/shared/lib/cn";

import type { EscaneoChat } from "../../model/escaneo";
import { TarjetaMesa } from "../mesa/TarjetasVenta";
import { BloqueProducto, BotonCta, BotonSecundario, Estado, FotoProducto, Tarjeta, formato } from "../piezas";
import type { DatosNuevo } from "./useEscaneoEnChat";

/**
 * Lo que el chat contesta a un código escaneado (ver `model/escaneo.ts`).
 *
 * Si la tienda lo tiene: la foto, el precio y dos botones, Vender o Comprar.
 * Si no: la misma tarjeta es el formulario, con lo que sabe el catálogo ya
 * puesto; falta el precio y se crea ahí mismo.
 */
export function TarjetaEscaneo({
  escaneo: e,
  storeId,
  hora,
  onVender,
  onComprar,
  onCrear,
  onMasDatos,
  onDescartar,
  onReintentar,
}: {
  escaneo: EscaneoChat;
  storeId: string;
  hora: string;
  onVender: () => void;
  onComprar: () => void;
  onCrear: (datos: DatosNuevo) => void;
  onMasDatos: () => void;
  onDescartar: () => void;
  onReintentar: () => void;
}) {
  switch (e.estado) {
    case "buscando":
      return (
        <Tarjeta estado="escaneo-buscando" hora={hora}>
          <p className="flex items-center gap-2.5 pr-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 shrink-0 animate-spin" />
            Buscando el código <span className="cifra text-foreground">{e.codigo}</span>…
          </p>
        </Tarjeta>
      );

    case "hecho":
      return <TarjetaMesa resumen={e.resumen ?? "Listo"} imagen={e.producto?.imagen ?? null} hora={hora} />;

    case "descartado":
      return (
        <div
          data-testid="omnibox-actividad"
          data-estado="descartado"
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-dashed border-border px-4 py-2.5 text-[13px] text-muted-foreground"
        >
          <X className="size-4 shrink-0" />
          <span>Descartado</span>
          <span className="cifra truncate line-through">{e.codigo}</span>
          <span className="cifra ml-auto text-[11px]">{hora}</span>
        </div>
      );

    case "error":
      return (
        <Tarjeta estado="error" hora={hora}>
          <Estado icono={AlertCircle} tono="error" titulo="No pude buscar el código">
            {e.error}
          </Estado>
          <div className="mt-3 sm:pl-11">
            <BotonSecundario onClick={onReintentar} className="w-full sm:w-auto">
              <RotateCcw />
              Reintentar
            </BotonSecundario>
          </div>
        </Tarjeta>
      );

    case "otra_tienda":
      return (
        <Tarjeta estado="aviso" hora={hora}>
          <Estado icono={Info} tono="aviso" titulo={`${e.resultado?.producto?.name ?? "Este producto"} no se vende en esta tienda`}>
            Está registrado, pero en otra tienda. Sumalo a esta desde Productos.
          </Estado>
        </Tarjeta>
      );

    case "elegir": {
      const p = e.producto!;
      return (
        <Tarjeta estado="escaneo" hora={hora}>
          <div data-testid="escaneo-encontrado">
            {e.creado ? (
              <p className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success-soft-foreground">
                <Check className="size-3.5" strokeWidth={3} />
                Producto creado
              </p>
            ) : null}
            <div className="flex flex-col gap-3 pr-0 sm:flex-row sm:items-center sm:pr-10">
              <BloqueProducto producto={p} detalle={p.stock > 0 ? `${formato(p.stock)} en stock` : "Sin stock"} />
              <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
                <BotonCta data-testid="escaneo-vender" onClick={onVender}>
                  <ShoppingCart />
                  Vender
                </BotonCta>
                <BotonSecundario data-testid="escaneo-comprar" onClick={onComprar}>
                  <Truck />
                  Comprar
                </BotonSecundario>
              </div>
            </div>
          </div>
        </Tarjeta>
      );
    }

    case "nuevo":
    case "creando":
      return (
        <FormularioNuevo
          escaneo={e}
          storeId={storeId}
          hora={hora}
          onCrear={onCrear}
          onMasDatos={onMasDatos}
          onDescartar={onDescartar}
        />
      );
  }
}

const CAMPO = "h-10 w-full min-w-0 rounded-lg border bg-card px-3 text-sm outline-none focus:border-primary";

/** Para comparar nombres: "Dulces y Mermeladas" = "dulces y mermeladas". */
const normal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** "12", "12,50", "" → número o null. */
function numero(v: string): number | null {
  const t = v.replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * La tienda no lo tiene: crearlo acá. Lo del catálogo ya viene puesto (y la
 * IA mejora la foto y arma la ficha mientras tanto); se pide lo único que no
 * se puede saber: a cuánto lo vende. Para la foto propia o la ficha completa,
 * "Más datos" abre la hoja de siempre.
 */
function FormularioNuevo({
  escaneo: e,
  storeId,
  hora,
  onCrear,
  onMasDatos,
  onDescartar,
}: {
  escaneo: EscaneoChat;
  storeId: string;
  hora: string;
  onCrear: (datos: DatosNuevo) => void;
  onMasDatos: () => void;
  onDescartar: () => void;
}) {
  const r = e.resultado!;
  const s = r.sugerencia;
  const { ia, generando } = useEnriquecimientoIa(r);
  const ficha = ia?.ficha ?? null;
  const { data: marcas = [] } = useBrands();
  const { data: categorias = [] } = useCategories(storeId);

  const delCatalogo = s ? (s.cantidad && !s.nombre.includes(s.cantidad) ? `${s.nombre} ${s.cantidad}` : s.nombre) : "";
  const [nombre, setNombre] = useState(ficha?.nombre ?? delCatalogo);
  const [precio, setPrecio] = useState("");
  const [stock, setStock] = useState("");
  // Lo que la persona escribió no lo pisa la ficha de la IA cuando llega.
  const tocoNombre = useRef(false);
  useEffect(() => {
    if (ficha?.nombre && !tocoNombre.current) setNombre(ficha.nombre);
  }, [ficha?.nombre]);

  // El foco al precio (o al nombre si no vino): es lo único que falta. En el
  // teléfono no, que el teclado taparía la foto.
  const esMovil = useIsMobile();
  const precioRef = useRef<HTMLInputElement>(null);
  const nombreRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (esMovil) return;
    (delCatalogo ? precioRef.current : nombreRef.current)?.focus({ preventScroll: true });
    // Solo al aparecer la tarjeta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const marca = ficha?.marca ?? s?.marca ?? null;
  const categoria = ficha?.categoria ?? null;
  const marcaExistente = useMemo(() => (marca ? marcas.find((m) => normal(m.name) === normal(marca)) : undefined), [marcas, marca]);
  const categoriaExistente = useMemo(
    () =>
      categoria
        ? categorias.find((c) => {
            const a = normal(c.name);
            const b = normal(categoria);
            return a === b || a.includes(b) || b.includes(a);
          })
        : undefined,
    [categorias, categoria],
  );
  const foto = ia?.imagenUrl ?? s?.imagenUrl ?? null;

  const precioNumero = numero(precio);
  const faltaNombre = nombre.trim().length < 2;
  const faltaPrecio = !(precioNumero && precioNumero > 0);
  const creando = e.estado === "creando";

  const enviar = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (faltaNombre || faltaPrecio || creando) return;
    const especificaciones = ficha && Object.keys(ficha.especificaciones).length ? ficha.especificaciones : s?.cantidad ? { Contenido: s.cantidad } : {};
    onCrear({
      name: nombre.trim(),
      price: precioNumero!,
      initialStock: Math.floor(numero(stock) ?? 0),
      ...(marca ? (marcaExistente ? { brandId: marcaExistente.id } : { brandName: marca }) : {}),
      ...(categoria ? (categoriaExistente ? { categoryId: categoriaExistente.id } : { categoryName: categoria }) : {}),
      description: ficha?.descripcion ?? undefined,
      imageUrls: foto ? [foto] : undefined,
      metadata: { tags: ficha?.etiquetas ?? [], specifications: especificaciones },
    } as DatosNuevo);
  };

  const detalle = [marca, categoriaExistente?.name ?? categoria].filter(Boolean).join(" · ");

  return (
    <Tarjeta estado="escaneo-nuevo" hora={hora}>
      <form data-testid="escaneo-nuevo" onSubmit={enviar}>
        <p
          className={cn(
            "mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
            s ? "bg-primary-soft text-primary-soft-foreground" : "bg-warning-soft text-warning-soft-foreground",
          )}
        >
          {s ? <Sparkles className="size-3.5" /> : <PackagePlus className="size-3.5" />}
          {s ? "Lo encontramos en el catálogo" : "Producto nuevo"}
        </p>
        <p className="mb-3 pr-10 text-[13px] text-muted-foreground">
          {s
            ? "No lo tenés en tu tienda. Ya lo completamos: poné el precio y crealo."
            : "Nadie cargó este código todavía. Ponele nombre y precio y queda creado."}
        </p>

        <div className="flex gap-3">
          <div className="shrink-0">
            <FotoProducto src={foto} className="size-[72px] object-contain" />
            {generando ? (
              <p className="mt-1 flex w-[72px] items-center gap-1 text-[10px] leading-tight text-muted-foreground">
                <Sparkles className="size-3 shrink-0 animate-pulse text-primary" />
                Mejorando la foto
              </p>
            ) : null}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <input
              ref={nombreRef}
              value={nombre}
              onChange={(ev) => {
                tocoNombre.current = true;
                setNombre(ev.target.value);
              }}
              placeholder="Nombre del producto"
              aria-label="Nombre del producto"
              maxLength={100}
              autoComplete="off"
              className={cn(CAMPO, "font-medium", faltaNombre ? "border-warning" : "border-border")}
            />
            <p className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
              <ScanBarcode className="size-3 shrink-0" />
              <span className="cifra shrink-0">{r.codigoLegible}</span>
              {detalle ? <span className="truncate">· {detalle}</span> : null}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] text-muted-foreground">Precio de venta (Bs)</span>
            <input
              ref={precioRef}
              value={precio}
              onChange={(ev) => setPrecio(ev.target.value.replace(/[^\d.,]/g, ""))}
              inputMode="decimal"
              placeholder="0,00"
              aria-label="Precio de venta"
              autoComplete="off"
              className={cn(CAMPO, "cifra font-semibold", faltaPrecio ? "border-warning" : "border-border")}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-muted-foreground">Stock que tenés (opcional)</span>
            <input
              value={stock}
              onChange={(ev) => setStock(ev.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="0"
              aria-label="Stock que tenés"
              autoComplete="off"
              className={cn(CAMPO, "cifra border-border")}
            />
          </label>
        </div>

        {e.error ? <p className="mt-2 text-xs font-medium text-destructive">{e.error}</p> : null}

        <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onMasDatos}
            disabled={creando}
            className="inline-flex items-center gap-1 self-start rounded-md px-1 text-[13px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 sm:mr-auto"
          >
            Más datos (foto propia, ficha)
            <ArrowUpRight className="size-3.5" />
          </button>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <BotonSecundario type="button" onClick={onDescartar} disabled={creando}>
              Descartar
            </BotonSecundario>
            <BotonCta type="submit" data-testid="escaneo-crear" disabled={faltaNombre || faltaPrecio || creando}>
              {creando ? <Loader2 className="animate-spin" /> : <PackagePlus />}
              Crear
            </BotonCta>
          </div>
        </div>
      </form>
    </Tarjeta>
  );
}
