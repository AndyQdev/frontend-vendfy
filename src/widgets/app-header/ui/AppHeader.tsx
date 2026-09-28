import { useLayoutEffect, useRef } from "react";

import { cn } from "@/shared/lib/cn";

import { BrandBlock } from "./BrandBlock";
import { HeaderActions } from "./HeaderActions";
import { NavigationRail } from "./NavigationRail";

/**
 * EL HEADER — tres bloques sueltos, no una barra.
 *
 *   Escritorio (≥1024):
 *   [ marca · tienda ]  [ rutas ···························· › ]  [ 🔔 🌐 perfil ]
 *     azul marino           burbuja blanca, se estira              burbuja blanca
 *
 *   Teléfono y tablet (<1024), dos filas:
 *   [ marca · tienda ]                                   🔔  ≡
 *   Asistente  Inicio  Caja  Pedidos ③  Ventas  ···  ← se desliza con el dedo
 *
 * Es UNA sola grilla que reacomoda sus tres hijos según el ancho: el carril es
 * el mismo componente en las dos disposiciones, no hay dos menús.
 *
 * Fijo arriba (`sticky`), con fondo sólido del color de la página: la marca,
 * la tienda y las rutas son referencia permanente, y sin fondo el contenido
 * se vería pasar por los huecos entre las burbujas.
 */
export function AppHeader({ className }: { className?: string }) {
  const ref = useRef<HTMLElement>(null);

  // Publica el alto real del header en `--alto-header`. Las pantallas que
  // ocupan exactamente el alto que queda (Caja, el chat de WhatsApp) lo restan
  // en vez de adivinarlo: en el teléfono el header tiene dos filas y en
  // escritorio una, y un número fijo servía para uno solo de los dos.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const publicar = () =>
      document.documentElement.style.setProperty("--alto-header", `${el.offsetHeight}px`);
    publicar();
    const observer = new ResizeObserver(publicar);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <header
      ref={ref}
      className={cn(
        "sticky top-0 z-40 bg-background",
        "pt-[max(0.75rem,env(safe-area-inset-top))] lg:pt-4",
        className
      )}
    >
      <div
        className={cn(
          "mx-auto grid w-full max-w-[var(--ancho-maximo)] grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto] items-center",
          "gap-x-2 gap-y-2.5 px-3 pb-2 sm:px-6 lg:gap-x-3 lg:pb-3"
        )}
      >
        <BrandBlock className="col-start-1 row-start-1 max-w-[70vw] lg:max-w-none" />

        <HeaderActions className="col-start-3 row-start-1 justify-self-end" />

        <NavigationRail className="col-span-3 col-start-1 row-start-2 lg:col-span-1 lg:col-start-2 lg:row-start-1" />
      </div>
    </header>
  );
}
