import { forwardRef, useState, type ComponentProps, type ReactNode } from "react";
import { ArrowRight, Coins, Package, type LucideIcon } from "lucide-react";

import { cn } from "@/shared/lib/cn";

/**
 * La foto del producto.
 *
 * Es lo primero que se mira: en un almacén la coca se reconoce por la botella,
 * no por el texto "Coca Cola 2L". Fondo blanco porque casi todas las fotos de
 * producto vienen recortadas sobre blanco, y sobre el vidrio oscuro quedan con
 * un borde gris sucio.
 *
 * Si la imagen no carga (link vencido, foto borrada) cae al ícono en vez de
 * dejar el hueco roto del navegador.
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
          "glass-track flex shrink-0 items-center justify-center rounded-xl",
          className,
        )}
      >
        <Package className="h-1/2 w-1/2 text-muted-foreground" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setRota(true)}
      className={cn("shrink-0 rounded-xl bg-white object-contain p-0.5", className)}
    />
  );
}

/**
 * El botón principal: cian lleno, texto oscuro.
 *
 * Texto oscuro a propósito: blanco sobre este cian da 2,4:1 y no se lee al sol,
 * que es donde se usa el teléfono en un puesto. Oscuro da más de 8:1.
 */
// Una sola línea siempre: a 390 px, con dos botones lado a lado, "Confirmar
// entrada" en dos renglones se lee como dos botones. Más chico en el teléfono
// antes que partido.
const TAMANO_BOTON =
  "inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-[13px] sm:gap-2 sm:px-4 sm:text-sm";

export const CLASE_CTA = cn(
  "press",
  TAMANO_BOTON,
  "bg-ring font-semibold text-slate-950",
  "shadow-[var(--cta-shadow)] transition-[filter] hover:brightness-110",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "disabled:pointer-events-none disabled:opacity-50",
);

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
          "press",
          TAMANO_BOTON,
          "border border-ring/50 font-medium text-foreground",
          "transition-colors hover:bg-ring/10",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);

/** La tarjeta de respuesta: vidrio, 22px, como las Card del panel. */
export function Tarjeta({
  estado,
  apagada,
  children,
}: {
  estado: string;
  /** Ya resuelta: se ve, pero no llama la atención. */
  apagada?: boolean;
  children: ReactNode;
}) {
  return (
    <article
      data-testid="omnibox-actividad"
      data-estado={estado}
      className={cn(
        "glass animate-in fade-in slide-in-from-bottom-2 space-y-3 rounded-[22px] p-3 duration-300 sm:p-4",
        apagada && "opacity-80",
      )}
    >
      {children}
    </article>
  );
}

export function Cabecera({ icono: Icono, children }: { icono: LucideIcon; children: ReactNode }) {
  return (
    <header className="flex items-center gap-2.5 px-1">
      <Icono className="h-5 w-5 shrink-0 text-muted-foreground" />
      <h3 className="text-sm font-semibold sm:text-[15px]">{children}</h3>
    </header>
  );
}

/** El panel hundido donde van producto, diff y total. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("glass-track rounded-2xl p-3", className)}>{children}</div>
  );
}

/** Línea vertical entre bloques; en pantallas angostas los bloques bajan y sobra. */
export function Divisor() {
  return <div aria-hidden className="hidden h-12 w-px bg-[var(--hairline-strong)] sm:block" />;
}

/**
 * El `12 → 32`.
 *
 * Es lo que hace que confirmar sea revisar y no creer: la tarjeta dice qué va a
 * QUEDAR, que es lo que el comerciante necesita mirar antes de apretar. El
 * número nuevo va en cian y más fuerte porque es el que importa.
 */
export function Diff({
  etiqueta,
  antes,
  despues,
  prefijo,
  icono: Icono = Package,
}: {
  etiqueta: string;
  antes: number;
  despues: number;
  prefijo?: string;
  icono?: LucideIcon;
}) {
  return (
    <div data-testid="omnibox-diff" className="space-y-1">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icono className="h-3.5 w-3.5" />
        {etiqueta}
      </p>
      <div className="glass-sm flex items-center gap-2 rounded-xl px-3 py-1.5 font-display tabular-nums">
        <span className="text-xl font-semibold text-foreground/80 sm:text-2xl">
          {prefijo}
          {formato(antes)}
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <span className="text-xl font-bold text-ring sm:text-2xl">
          {prefijo}
          {formato(despues)}
        </span>
      </div>
    </div>
  );
}

export function Total({ monto, apagado }: { monto: number; apagado?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Coins className="h-3.5 w-3.5" />
        Total
      </p>
      <p
        className={cn(
          "font-display font-bold tabular-nums",
          apagado ? "text-xl text-foreground" : "text-2xl text-ring sm:text-3xl",
        )}
      >
        Bs {formato(monto)}
      </p>
    </div>
  );
}

/** 240 → "240"; 12.5 → "12.50". Sin decimales cuando no los hay: se lee más rápido. */
export function formato(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString("es-BO") : n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
