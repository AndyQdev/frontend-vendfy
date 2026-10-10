import { useEffect, useState } from "react";
import { animate, motion, useReducedMotion } from "motion/react";
import { Package } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { formatMoney } from "@/shared/lib/money";

/** La foto del producto, con un respaldo si no hay o no carga. */
export function ImagenProducto({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [fallo, setFallo] = useState(false);
  useEffect(() => setFallo(false), [src]);

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0, rotate: -4 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary-soft to-muted",
        className,
      )}
    >
      {src && !fallo ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFallo(true)}
          className="h-full w-full bg-white object-contain p-[6%]"
        />
      ) : (
        <Package className="size-1/3 text-primary/60" aria-hidden />
      )}
    </motion.div>
  );
}

/**
 * Un código de barras dibujado a partir del número, con el láser pasando por
 * encima mientras se busca. No es un código escaneable: es la imagen que
 * todos reconocen como "esto es lo que leyó la pistola".
 */
export function CodigoDeBarras({
  codigo,
  buscando = false,
  className,
}: {
  codigo: string;
  buscando?: boolean;
  className?: string;
}) {
  const reducido = useReducedMotion();
  // Anchos de barra derivados de los dígitos: el mismo código siempre se ve igual.
  const barras = Array.from(codigo.replace(/\D/g, "").padEnd(12, "7")).flatMap((d, i) => {
    const n = Number(d) || (i % 3) + 1;
    return [1 + (n % 3), 1 + ((n + i) % 2)];
  });

  return (
    <div className={cn("relative mx-auto w-fit", className)}>
      <div className="flex h-16 items-stretch gap-[2px] rounded-xl bg-white px-4 py-2.5 shadow-inner ring-1 ring-border">
        {barras.map((ancho, i) => (
          <motion.span
            key={i}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: reducido ? 0 : i * 0.008, duration: 0.25 }}
            className={cn("origin-bottom rounded-[1px]", i % 2 === 0 ? "bg-slate-900" : "bg-transparent")}
            style={{ width: ancho * 1.5 }}
          />
        ))}
      </div>
      {buscando && !reducido && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-x-1 h-0.5 rounded-full bg-red-500 shadow-[0_0_12px_3px_rgba(239,68,68,0.55)]"
          initial={{ top: "12%" }}
          animate={{ top: ["12%", "86%", "12%"] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <p className="mt-1.5 text-center font-mono text-xs tracking-[0.2em] text-muted-foreground">{codigo}</p>
    </div>
  );
}

/** El precio sube desde cero hasta su valor: el ojo va directo a la cifra. */
export function PrecioAnimado({ valor, className }: { valor: number; className?: string }) {
  const reducido = useReducedMotion();
  const [mostrado, setMostrado] = useState(reducido ? valor : 0);

  useEffect(() => {
    if (reducido) {
      setMostrado(valor);
      return;
    }
    const control = animate(0, valor, {
      duration: 0.7,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: setMostrado,
    });
    return () => control.stop();
  }, [valor, reducido]);

  return <span className={cn("font-display tabular-nums", className)}>{formatMoney(mostrado)}</span>;
}

/** Contenedor que hace entrar a sus hijos uno detrás de otro. */
export const escalonado = {
  oculto: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

export const aparece = {
  oculto: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 320, damping: 26 } },
};
