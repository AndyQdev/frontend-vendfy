import * as React from "react";

import { cn } from "../lib/cn";

/**
 * LA TABLA, EN EL TELÉFONO.
 *
 * Una tabla de ocho columnas en 360 px no se arregla con scroll horizontal:
 * hay que cambiar de forma. De `md` para arriba la tabla queda exactamente
 * como está; abajo se dibuja esta lista.
 *
 * Se resuelve con `md:hidden` / `hidden md:block` y no con `useIsMobile`,
 * porque así el escritorio no cambia ni un píxel y no hay un primer fotograma
 * dibujado con la forma equivocada.
 *
 *   <ListaTarjetas>
 *     {filas.map((f) => (
 *       <TarjetaFila key={f.id} onClick={() => abrir(f)}>
 *         <FilaTitulo titulo={f.nombre} subtitulo={f.codigo} />
 *         <FilaDatos datos={[{ etiqueta: "Precio", valor: "150" }]} />
 *       </TarjetaFila>
 *     ))}
 *   </ListaTarjetas>
 *
 * Regla de contenido: dos a cuatro datos, los que de verdad identifican la
 * fila, más la acción principal. El resto se ve al abrir el detalle.
 */
export function ListaTarjetas({
  className,
  ...props
}: React.HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn("space-y-2 md:hidden", className)} {...props} />;
}

/** El contenedor de la tabla. Desaparece en el teléfono. */
export function SoloEscritorio({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("hidden md:block", className)} {...props} />;
}

export function TarjetaFila({
  onClick,
  acciones,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLLIElement> & {
  onClick?: () => void;
  /**
   * Los botones de la fila, normalmente dentro de <FilaAcciones>.
   *
   * Van en una ranura propia y no entre los `children`, porque cuando la
   * tarjeta es clickeable los `children` viven dentro de un <button> y un
   * botón anidado es HTML inválido: el navegador lo desarma y el de adentro
   * deja de responder.
   */
  acciones?: React.ReactNode;
}) {
  const clickeable = typeof onClick === "function";

  return (
    <li
      className={cn(
        "rounded-xl border border-border bg-card p-3",
        clickeable && "cursor-pointer transition-colors active:bg-muted",
        className,
      )}
      {...props}
    >
      {clickeable ? (
        // Un <button> y no un onClick en el <li>: así entra por teclado, lo
        // anuncia el lector de pantalla y el área táctil es toda la tarjeta.
        <button
          type="button"
          onClick={onClick}
          className="flex w-full flex-col gap-2 text-left"
        >
          {children}
        </button>
      ) : (
        <div className="flex flex-col gap-2">{children}</div>
      )}
      {acciones}
    </li>
  );
}

/** Lo que identifica la fila: de un vistazo, sin leer el resto. */
export function FilaTitulo({
  titulo,
  subtitulo,
  medio,
  derecha,
  className,
}: {
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  /** Miniatura o ícono. */
  medio?: React.ReactNode;
  /** Estado o importe: lo que se mira sin leer. */
  derecha?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-start gap-3", className)}>
      {medio}
      <div className="min-w-0 flex-1">
        {/* <div> y no <p>: el título a veces es un esqueleto de carga, y un
            <div> dentro de un <p> hace que el navegador cierre el párrafo
            antes de tiempo y rompa la fila. */}
        <div className="truncate text-sm font-semibold">{titulo}</div>
        {subtitulo ? (
          <div className="truncate text-xs text-muted-foreground">{subtitulo}</div>
        ) : null}
      </div>
      {derecha ? <div className="shrink-0 text-right">{derecha}</div> : null}
    </div>
  );
}

export interface DatoFila {
  etiqueta: string;
  valor: React.ReactNode;
}

/**
 * Los dos o tres datos secundarios.
 *
 * `min-w-0` en cada celda porque un nombre largo, con `min-width: auto`, le
 * gana al `max-width` de la grilla y ensancha la tarjeta.
 */
export function FilaDatos({
  datos,
  className,
}: {
  datos: DatoFila[];
  className?: string;
}) {
  if (!datos.length) return null;
  return (
    <dl
      className={cn(
        "grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-x-3 gap-y-1",
        className,
      )}
    >
      {datos.map((d) => (
        <div key={d.etiqueta} className="min-w-0">
          <dt className="etiqueta text-[10px] text-muted-foreground">
            {d.etiqueta}
          </dt>
          <dd className="truncate text-sm">{d.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * La acción principal de la fila.
 *
 * Se pasa por la prop `acciones` de <TarjetaFila>, no como hijo: así queda
 * fuera del <button> de la tarjeta. Un botón dentro de otro botón es HTML
 * inválido y el navegador lo desarma, dejando el de adentro sin funcionar.
 */
export function FilaAcciones({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-1 border-t border-border/60 pt-2",
        className,
      )}
      {...props}
    />
  );
}
