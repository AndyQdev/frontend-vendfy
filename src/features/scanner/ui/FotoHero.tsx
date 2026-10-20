import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Camera, ImageOff, ImagePlus, Loader2, Sparkles, Wand2 } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn";

export type FuenteFoto = "ia" | "original" | "propia";

interface Props {
  /** La del catálogo (fea pero real). */
  original: string | null;
  /** La que generó la IA, cuando esté. */
  mejorada: string | null;
  /** La que subió el comercio. */
  propia: string | null;
  seleccion: FuenteFoto | null;
  onSeleccion: (fuente: FuenteFoto) => void;
  /** La IA está trabajando (la del catálogo o la propia). */
  generando: boolean;
  subiendo: boolean;
  onSubir: (archivo: File) => void;
  /** Mejorar la foto propia con IA. Sin esto, no se ofrece. */
  onMejorarPropia?: () => void;
  alt: string;
}

/**
 * La foto del producto, protagonista de la hoja.
 *
 * Mientras la IA trabaja se ve la del catálogo apagada, con un brillo que la
 * recorre y el aviso de qué está pasando. Cuando la mejorada llega, se revela
 * desde el centro: el cambio de "foto de celular" a "foto de estudio" es lo
 * que tiene que notarse.
 */
export function FotoHero({
  original,
  mejorada,
  propia,
  seleccion,
  onSeleccion,
  generando,
  subiendo,
  onSubir,
  onMejorarPropia,
  alt,
}: Props) {
  const reducido = useReducedMotion();
  const archivoRef = useRef<HTMLInputElement>(null);
  const [fallo, setFallo] = useState<Record<string, boolean>>({});

  const url =
    seleccion === "ia" ? mejorada : seleccion === "propia" ? propia : seleccion === "original" ? original : null;
  const visible = url && !fallo[url] ? url : null;
  // Mientras se genera se muestra la base sobre la que trabaja la IA.
  const base = !visible && generando ? (propia ?? original) : null;

  const opciones: Array<{ id: FuenteFoto; etiqueta: string; icono: typeof Sparkles; disponible: boolean }> = [
    { id: "ia", etiqueta: "Mejorada", icono: Sparkles, disponible: !!mejorada },
    { id: "original", etiqueta: "Catálogo", icono: ImageOff, disponible: !!original },
    { id: "propia", etiqueta: "Tu foto", icono: Camera, disponible: !!propia },
  ];
  const mostrables = opciones.filter((o) => o.disponible);

  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-border bg-white shadow-[0_18px_50px_-24px_hsl(var(--foreground)/0.35)]">
        <AnimatePresence mode="popLayout" initial={false}>
          {visible ? (
            <motion.img
              key={visible}
              src={visible}
              alt={alt}
              referrerPolicy="no-referrer"
              onError={() => setFallo((f) => ({ ...f, [visible]: true }))}
              // Mientras la IA trabaja sobre esta foto, queda apagada debajo del brillo.
              className={cn(
                "absolute inset-0 h-full w-full object-contain p-4 transition-[filter,opacity] duration-500",
                generando && "opacity-60 blur-[1.5px] saturate-50",
              )}
              initial={
                seleccion === "ia" && !reducido
                  ? { clipPath: "circle(0% at 50% 50%)", scale: 1.04 }
                  : { opacity: 0 }
              }
              animate={{ clipPath: "circle(75% at 50% 50%)", scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: seleccion === "ia" ? 0.9 : 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            />
          ) : base ? (
            <motion.img
              key={`base-${base}`}
              src={base}
              alt=""
              aria-hidden
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-contain p-4 opacity-60 blur-[1.5px] saturate-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
            />
          ) : (
            <motion.button
              key="vacio"
              type="button"
              onClick={() => archivoRef.current?.click()}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-3 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-gradient-to-br from-primary-soft/60 to-muted/40 text-center transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="grid size-14 place-items-center rounded-2xl bg-card shadow-sm ring-1 ring-border">
                <ImagePlus className="size-7 text-primary" aria-hidden />
              </span>
              <span className="text-sm font-semibold text-foreground">Agrega una foto</span>
              <span className="max-w-[220px] text-xs text-muted-foreground">
                Sácala con el celular o súbela. Después la dejamos profesional con IA.
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* La IA trabajando: un brillo que barre la foto y el aviso. */}
        <AnimatePresence>
          {generando && (
            <motion.div
              key="generando"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.4 } }}
              className="pointer-events-none absolute inset-0"
            >
              {!reducido && (
                <motion.div
                  className="absolute inset-y-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/70 to-transparent"
                  initial={{ left: "-60%" }}
                  animate={{ left: "120%" }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.2 }}
                />
              )}
              {!reducido &&
                [
                  { x: "18%", y: "22%", d: 0 },
                  { x: "78%", y: "30%", d: 0.6 },
                  { x: "30%", y: "74%", d: 1.1 },
                  { x: "70%", y: "70%", d: 0.3 },
                ].map((p, i) => (
                  <motion.span
                    key={i}
                    className="absolute"
                    style={{ left: p.x, top: p.y }}
                    animate={{ scale: [0, 1, 0], opacity: [0, 1, 0], rotate: [0, 90] }}
                    transition={{ duration: 1.8, repeat: Infinity, delay: p.d }}
                  >
                    <Sparkles className="size-5 text-acento drop-shadow" />
                  </motion.span>
                ))}
              <div className="absolute inset-x-0 bottom-4 flex justify-center">
                <span className="inline-flex items-center gap-2 rounded-full bg-tinta/85 px-3.5 py-2 text-xs font-semibold text-tinta-foreground shadow-lg backdrop-blur">
                  <Wand2 className="size-3.5 text-acento" aria-hidden />
                  Creando una foto profesional…
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {seleccion === "ia" && visible && (
          <motion.span
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-tinta/85 px-2.5 py-1 text-[11px] font-semibold text-tinta-foreground shadow backdrop-blur"
          >
            <Sparkles className="size-3 text-acento" aria-hidden />
            Mejorada con IA
          </motion.span>
        )}

        {subiendo && (
          <div className="absolute inset-0 grid place-items-center bg-card/70 backdrop-blur-sm">
            <Loader2 className="size-7 animate-spin text-primary" aria-label="Subiendo foto" />
          </div>
        )}
      </div>

      {/* Qué foto usar. Solo aparece si hay más de una para elegir. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {mostrables.length > 1 && (
          <div role="radiogroup" aria-label="Foto del producto" className="inline-flex rounded-xl bg-muted p-1">
            {mostrables.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={seleccion === o.id}
                onClick={() => onSeleccion(o.id)}
                className={cn(
                  "relative inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  seleccion === o.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {seleccion === o.id && (
                  <motion.span
                    layoutId="foto-seleccion"
                    className="absolute inset-0 rounded-lg bg-card shadow-sm"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <o.icono className="relative size-3.5" aria-hidden />
                <span className="relative">{o.etiqueta}</span>
              </button>
            ))}
          </div>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => archivoRef.current?.click()}
          disabled={subiendo}
        >
          <Camera aria-hidden />
          {propia ? "Cambiar foto" : "Subir foto"}
        </Button>

        {onMejorarPropia && propia && seleccion === "propia" && (
          <Button type="button" variant="soft" size="sm" onClick={onMejorarPropia} loading={generando}>
            {!generando && <Wand2 aria-hidden />}
            Mejorar con IA
          </Button>
        )}

        <input
          ref={archivoRef}
          type="file"
          // Sin `capture`: en el celular ofrece cámara Y galería; con él, solo cámara.
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            if (archivo) onSubir(archivo);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
