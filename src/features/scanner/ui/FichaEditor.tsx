import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ListChecks, Plus, Sparkles, Tags, X } from "lucide-react";

import { Label } from "@/shared/ui/label";
import { Skeleton } from "@/shared/ui/skeleton";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/lib/cn";

interface Props {
  descripcion: string;
  onDescripcion: (v: string) => void;
  etiquetas: string[];
  onEtiquetas: (v: string[]) => void;
  especificaciones: Array<[string, string]>;
  onEspecificaciones: (v: Array<[string, string]>) => void;
  /** La IA todavía está armando la ficha: se muestran esqueletos. */
  cargando: boolean;
  /** La ficha vino de la IA (cambia el encabezado). */
  deIa: boolean;
}

/**
 * La ficha del producto para la tienda online: descripción, etiquetas para
 * que lo encuentren y especificaciones. Llega armada por la IA a partir del
 * catálogo y la foto; el comercio solo corrige lo que quiera.
 */
export function FichaEditor({
  descripcion,
  onDescripcion,
  etiquetas,
  onEtiquetas,
  especificaciones,
  onEspecificaciones,
  cargando,
  deIa,
}: Props) {
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState("");
  const [nuevaClave, setNuevaClave] = useState("");
  const [nuevoValor, setNuevoValor] = useState("");

  const agregarEtiqueta = () => {
    const e = nuevaEtiqueta.trim().toLowerCase();
    if (e && !etiquetas.includes(e)) onEtiquetas([...etiquetas, e]);
    setNuevaEtiqueta("");
  };
  const agregarEspecificacion = () => {
    if (!nuevaClave.trim() || !nuevoValor.trim()) return;
    onEspecificaciones([...especificaciones.filter(([k]) => k !== nuevaClave.trim()), [nuevaClave.trim(), nuevoValor.trim()]]);
    setNuevaClave("");
    setNuevoValor("");
  };
  // Enter dentro de estos campos agrega, no manda el formulario.
  const conEnter = (accion: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      accion();
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-muted/30 p-4">
      <header className="flex items-center justify-between gap-2">
        <h3 className="font-display text-sm font-semibold">Ficha para tu tienda</h3>
        {(deIa || cargando) && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              cargando ? "bg-muted text-muted-foreground" : "bg-primary-soft text-primary-soft-foreground",
            )}
          >
            <Sparkles className={cn("size-3", cargando && "animate-pulse")} aria-hidden />
            {cargando ? "La IA la está escribiendo…" : "Armada con IA"}
          </span>
        )}
      </header>

      <div className="space-y-1.5">
        <Label htmlFor="escaner-descripcion">Descripción</Label>
        {cargando && !descripcion ? (
          <div className="space-y-2 rounded-lg border border-input bg-card p-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ) : (
          <Textarea
            id="escaner-descripcion"
            value={descripcion}
            onChange={(e) => onDescripcion(e.target.value)}
            rows={3}
            placeholder="Cuéntale al cliente qué es y por qué le conviene."
            className="resize-none bg-card text-sm"
          />
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="escaner-etiqueta" className="inline-flex items-center gap-1.5">
          <Tags className="size-3.5 text-muted-foreground" aria-hidden />
          Etiquetas
        </Label>
        <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-card p-1.5">
          {cargando && !etiquetas.length
            ? [64, 48, 72, 56].map((w, i) => <Skeleton key={i} className="h-6 rounded-full" style={{ width: w }} />)
            : null}
          <AnimatePresence initial={false}>
            {etiquetas.map((e) => (
              <motion.span
                key={e}
                layout
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-0.5 pl-2.5 pr-1 text-xs font-medium text-primary-soft-foreground"
              >
                {e}
                <button
                  type="button"
                  aria-label={`Quitar ${e}`}
                  onClick={() => onEtiquetas(etiquetas.filter((x) => x !== e))}
                  className="grid size-4 place-items-center rounded-full hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
          <input
            id="escaner-etiqueta"
            value={nuevaEtiqueta}
            onChange={(e) => setNuevaEtiqueta(e.target.value)}
            onKeyDown={conEnter(agregarEtiqueta)}
            onBlur={agregarEtiqueta}
            placeholder={etiquetas.length ? "+ otra" : "Ej.: sin azúcar"}
            maxLength={30}
            className="min-w-[90px] flex-1 bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="inline-flex items-center gap-1.5">
          <ListChecks className="size-3.5 text-muted-foreground" aria-hidden />
          Especificaciones
        </Label>
        <div className="overflow-hidden rounded-lg border border-input bg-card">
          {cargando && !especificaciones.length && (
            <div className="space-y-2 p-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}
          <AnimatePresence initial={false}>
            {especificaciones.map(([clave, valor]) => (
              <motion.div
                key={clave}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="group flex items-start gap-3 border-b border-border/70 px-3 py-2 text-sm last:border-b-0"
              >
                <span className="w-28 shrink-0 font-medium text-muted-foreground">{clave}</span>
                <span className="min-w-0 flex-1 break-words">{valor}</span>
                <button
                  type="button"
                  aria-label={`Quitar ${clave}`}
                  onClick={() => onEspecificaciones(especificaciones.filter(([k]) => k !== clave))}
                  className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground opacity-60 transition hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          <div className="flex items-center gap-2 border-t border-border/70 bg-muted/30 px-2 py-1.5">
            <input
              aria-label="Nueva especificación: nombre"
              value={nuevaClave}
              onChange={(e) => setNuevaClave(e.target.value)}
              onKeyDown={conEnter(agregarEspecificacion)}
              placeholder="Ej.: Sabor"
              maxLength={40}
              className="w-28 shrink-0 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground"
            />
            <input
              aria-label="Nueva especificación: valor"
              value={nuevoValor}
              onChange={(e) => setNuevoValor(e.target.value)}
              onKeyDown={conEnter(agregarEspecificacion)}
              placeholder="Ej.: Durazno"
              maxLength={300}
              className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              aria-label="Agregar especificación"
              onClick={agregarEspecificacion}
              disabled={!nuevaClave.trim() || !nuevoValor.trim()}
              className="grid size-7 place-items-center rounded-md text-primary hover:bg-primary-soft disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
