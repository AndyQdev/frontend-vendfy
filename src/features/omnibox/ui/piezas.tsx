import { forwardRef, useState, type ComponentProps, type ReactNode } from "react";
import { ArrowRight, Package, type LucideIcon } from "lucide-react";

import type { ProductoOpcion } from "@/entities/omnibox/model/types";
import { cn } from "@/shared/lib/cn";

/**
 * Las piezas con las que se arman todas las respuestas del asistente.
 *
 * Una tarjeta blanca con borde, radio 16 px y sombra apenas visible —la misma
 * superficie que el resto del panel—, y adentro siempre el mismo orden:
 * producto a la izquierda, lo que cambia en el medio, los botones a la derecha.
 * En el teléfono ese orden se apila, no se achica.
 */

// ------------------------------------------------------------ foto

/**
 * La foto del producto: es lo primero que se mira. En un almacén la coca se
 * reconoce por la botella, no por el texto "Coca Cola 2L". Si no carga, cae al
 * ícono en vez de dejar el hueco roto del navegador.
 */
export function FotoProducto({
  src,
  className,
}: {
  src: string | null | undefined;
  className?: string;
}) {
  const [rota, setRota] = useState(false);

  if (!src || rota) {
    return (
      <div
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center rounded-[10px] border border-border bg-muted",
          className,
        )}
      >
        <Package className="h-1/2 w-1/2 text-muted-foreground/70" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setRota(true)}
      className={cn("shrink-0 rounded-[10px] border border-border bg-white object-cover", className)}
    />
  );
}

// ------------------------------------------------------------ botones

/**
 * Botones de la tarjeta: 38 px, radio 10. El principal en cian oscuro con texto
 * blanco (5,4:1); el secundario blanco con borde. Una sola línea siempre: a
 * 390 px "Confirmar entrada" en dos renglones se lee como dos botones.
 */
const TAMANO_BOTON =
  "inline-flex h-[38px] items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-4 text-[13px] font-semibold transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

export const CLASE_CTA = cn(TAMANO_BOTON, "bg-primary text-primary-foreground hover:bg-primary-strong");

export const BotonCta = forwardRef<HTMLButtonElement, ComponentProps<"button">>(
  function BotonCta({ className, ...props }, ref) {
    return <button ref={ref} className={cn(CLASE_CTA, className)} {...props} />;
  },
);

export const BotonSecundario = forwardRef<HTMLButtonElement, ComponentProps<"button">>(
  function BotonSecundario({ className, ...props }, ref) {
    return (
      <button
        ref={ref}
        className={cn(
          TAMANO_BOTON,
          "border border-input bg-card text-foreground hover:border-border-strong hover:bg-muted",
          className,
        )}
        {...props}
      />
    );
  },
);

/**
 * Botón cuadrado con solo ícono (ampliar, cerrar, fijar, exportar). Reenvía
 * la ref para poder ser el disparador de un menú.
 */
export const BotonIcono = forwardRef<HTMLButtonElement, ComponentProps<"button"> & { etiqueta: string }>(
  function BotonIcono({ etiqueta, className, children, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={etiqueta}
        title={etiqueta}
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-border-strong hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);

// ------------------------------------------------------------ tarjeta

/** La tarjeta de respuesta. `hora` va arriba a la derecha, chica y gris. */
export function Tarjeta({
  estado,
  hora,
  className,
  children,
}: {
  estado: string;
  hora?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <article
      data-testid="omnibox-actividad"
      data-estado={estado}
      className={cn(
        "relative min-w-0 flex-1 rounded-xl border border-border bg-card p-3 shadow-card sm:p-4",
        "animate-in fade-in duration-200",
        className,
      )}
    >
      {hora ? (
        <span className="cifra absolute right-3 top-3 text-[11px] text-muted-foreground sm:right-4">
          {hora}
        </span>
      ) : null}
      {children}
    </article>
  );
}

/** Título chico de la tarjeta, cuando hace falta decir qué es. */
export function Cabecera({ icono: Icono, children }: { icono: LucideIcon; children: ReactNode }) {
  return (
    <header className="mb-3 flex items-center gap-2 pr-12">
      <Icono className="h-4 w-4 shrink-0 text-muted-foreground" />
      <h3 className="font-sans text-sm font-semibold tracking-normal">{children}</h3>
    </header>
  );
}

/**
 * Estado con ícono redondo: "Listo" en verde, "No tenés permiso" en ámbar, un
 * error en rojo. Título en marino, el detalle en gris debajo.
 */
export function Estado({
  icono: Icono,
  tono,
  titulo,
  children,
}: {
  icono: LucideIcon;
  tono: "exito" | "aviso" | "error" | "neutro";
  titulo: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 pr-12">
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full",
          tono === "exito" && "bg-success text-success-foreground",
          tono === "aviso" && "bg-warning-soft text-warning",
          tono === "error" && "bg-destructive-soft text-destructive",
          tono === "neutro" && "bg-muted text-muted-foreground",
        )}
      >
        <Icono className="size-4" strokeWidth={tono === "exito" ? 3 : 2.2} />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-semibold text-foreground">{titulo}</p>
        {children ? <div className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{children}</div> : null}
      </div>
    </div>
  );
}

/** Línea vertical entre columnas; en el teléfono las columnas se apilan y sobra. */
export function Divisor() {
  return <div aria-hidden className="hidden w-px self-stretch bg-border sm:block" />;
}

// ------------------------------------------------------------ producto

/**
 * El producto: foto, nombre, código y precio. El precio va en monoespaciada
 * y más oscuro: es el dato que se compara.
 */
export function BloqueProducto({
  producto,
  nombre,
  detalle,
  compacto,
}: {
  producto: ProductoOpcion | null;
  nombre?: string;
  detalle?: string | null;
  /** En el teléfono la foto baja a 52 px y el código se esconde. */
  compacto?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <FotoProducto src={producto?.imagen} className={compacto ? "size-[52px]" : "size-[52px] sm:size-16"} />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold text-foreground sm:text-[15px]">
          {producto?.nombre ?? nombre}
        </p>
        {detalle ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{detalle}</p> : null}
        {producto?.codigo ? (
          <p className="mt-0.5 hidden truncate text-xs text-muted-foreground sm:block">
            SKU: <span className="cifra">{producto.codigo}</span>
          </p>
        ) : null}
        {producto ? (
          <p className="cifra mt-1 text-[15px] font-bold text-foreground">Bs {dinero(producto.precio)}</p>
        ) : null}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ cambio

/**
 * El `12 un → 32 un`: lo que hace que confirmar sea revisar y no creer. La
 * tarjeta dice qué va a QUEDAR, y el número nuevo va en cian oscuro y más
 * fuerte porque es el que importa.
 *
 * En escritorio son dos columnas con su etiqueta; en el teléfono, una línea:
 * "Stock: 12 → 32 un".
 */
export function Diff({
  etiqueta,
  antes,
  despues,
  precio,
}: {
  etiqueta: string;
  antes: number;
  despues: number;
  /** Es plata: "Bs 35,00" en vez de "35 un". */
  precio?: boolean;
}) {
  const valor = (n: number) => (precio ? `Bs ${dinero(n)}` : `${formato(n)} un`);
  const nombre = etiqueta.toLowerCase();

  return (
    <div data-testid="omnibox-diff" className="shrink-0">
      {/* Teléfono: una línea. */}
      <p className="flex items-center gap-1.5 text-[13px] sm:hidden">
        <span className="text-muted-foreground">{etiqueta}:</span>
        <span className="cifra font-semibold text-foreground">{valor(antes)}</span>
        <ArrowRight className="size-3.5 text-muted-foreground" />
        <span className="cifra font-bold text-primary">{valor(despues)}</span>
      </p>

      {/* Escritorio: dos columnas con etiqueta. */}
      <div className="hidden items-end gap-5 sm:flex">
        <div>
          <p className="text-xs text-muted-foreground">{etiqueta} actual</p>
          <p className="cifra mt-1 text-[17px] font-semibold text-foreground">{valor(antes)}</p>
        </div>
        <ArrowRight className="mb-1 size-4 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Nuevo {nombre}</p>
          <p className="cifra mt-1 text-[17px] font-bold text-primary">{valor(despues)}</p>
        </div>
      </div>
    </div>
  );
}

/** Lo que cuesta la entrada. En el teléfono, una línea como el cambio de stock. */
export function Total({ monto }: { monto: number }) {
  return (
    <div className="shrink-0">
      <p className="flex items-center gap-1.5 text-[13px] sm:hidden">
        <span className="text-muted-foreground">Total:</span>
        <span className="cifra font-bold text-foreground">Bs {dinero(monto)}</span>
      </p>
      <div className="hidden sm:block">
        <p className="text-xs text-muted-foreground">Total</p>
        <p className="cifra mt-1 text-[17px] font-bold text-foreground">Bs {dinero(monto)}</p>
      </div>
    </div>
  );
}

/** 240 → "240"; 12.5 → "12,5". Sin decimales cuando no los hay: se lee más rápido. */
export function formato(n: number): string {
  return Number.isInteger(n)
    ? n.toLocaleString("es-BO")
    : n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Plata siempre con dos decimales: "Bs 240,00". */
export function dinero(n: number): string {
  return Number(n).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
