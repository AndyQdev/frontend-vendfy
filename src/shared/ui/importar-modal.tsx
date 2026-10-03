import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Check, ClipboardPaste, Loader2 } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/shared/ui/responsive-dialog";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/lib/cn";

/** Lo que devuelve cualquier parser de importación. */
export type ResultadoParseo<T> = {
  items: T[];
  /** Cómo se leyó el texto; se le muestra a la persona para que confíe. */
  formato: string;
  /** Por qué no se pudo leer nada, o una advertencia. `null` si salió bien. */
  error: string | null;
};

interface ImportarModalProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  descripcion: string;
  placeholder: string;
  /** Nota bajo el textarea mientras todavía no se pegó nada. */
  ayuda?: ReactNode;
  parsear: (texto: string) => ResultadoParseo<T>;
  /** Vista previa de lo leído; el caparazón pone la caja y el scroll. */
  renderPreview: (items: T[]) => ReactNode;
  /** Texto del botón, que cambia según lo que se haya leído. */
  etiquetaAccion: (items: T[]) => string;
  /** Si lo leído alcanza para importar; por defecto, que haya algo. */
  puedeConfirmar?: (items: T[]) => boolean;
  /** Aviso extra en el resumen, como cuántos reemplazan a los que ya están. */
  aviso?: (items: T[]) => ReactNode;
  onConfirmar: (items: T[]) => void | Promise<void>;
  className?: string;
}

/**
 * El caparazón de "pegar una lista y que se cargue sola".
 *
 * Es el mismo gesto para especificaciones, etiquetas y reseñas: se pega texto,
 * se interpreta mientras se escribe y se muestra el resultado ANTES de tocar
 * nada. Ver los renglones ya separados es la confirmación de que se leyó lo
 * que se quería; que algo se guarde solo desde un formato incierto es
 * exactamente lo contrario.
 *
 * Lo que cambia en cada caso es el parser y cómo se dibuja la previa. El resto
 * -el textarea, el conteo, los errores, el botón que espera- vive acá una sola
 * vez.
 */
export function ImportarModal<T>({
  open,
  onOpenChange,
  titulo,
  descripcion,
  placeholder,
  ayuda,
  parsear,
  renderPreview,
  etiquetaAccion,
  puedeConfirmar,
  aviso,
  onConfirmar,
  className,
}: ImportarModalProps<T>) {
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Cada apertura empieza en blanco: lo de la vez pasada ya se importó.
  useEffect(() => {
    if (open) {
      setTexto("");
      setGuardando(false);
    }
  }, [open]);

  const { items, formato, error } = useMemo(() => parsear(texto), [texto, parsear]);

  const habilitado =
    items.length > 0 && (puedeConfirmar?.(items) ?? true) && !guardando;

  const confirmar = async () => {
    if (!habilitado) return;
    setGuardando(true);
    try {
      await onConfirmar(items);
      onOpenChange(false);
    } catch {
      // El error se avisa donde se sabe qué falló; acá solo se deja el modal
      // abierto para no perder lo que la persona pegó.
      setGuardando(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={guardando ? () => {} : onOpenChange}>
      <ResponsiveDialogContent className={cn("sm:max-w-[560px]", className)}>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{titulo}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{descripcion}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-4 py-2">
          <Textarea
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={placeholder}
            spellCheck={false}
            disabled={guardando}
            className="min-h-[180px] font-mono leading-relaxed md:text-xs"
          />

          {texto.trim() === "" ? (
            ayuda && <div className="text-xs text-muted-foreground">{ayuda}</div>
          ) : error && items.length === 0 ? (
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
                  <Check className="h-3.5 w-3.5" />
                  {etiquetaAccion(items)}
                  {formato && (
                    <span className="font-normal text-muted-foreground">
                      · leído como {formato}
                    </span>
                  )}
                </span>
                {aviso?.(items)}
              </div>

              {error && (
                <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                  {error}
                </p>
              )}

              <div className="max-h-[240px] overflow-y-auto overscroll-contain rounded-xl border border-border/60 p-2">
                {renderPreview(items)}
              </div>
            </div>
          )}
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <Button
            variant="outline"
            disabled={guardando}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={!habilitado}>
            {guardando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ClipboardPaste className="mr-2 h-4 w-4" />
            )}
            {guardando ? "Importando…" : etiquetaAccion(items)}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

/** El botoncito que abre cualquiera de estos modales. */
export function BotonImportar({
  onClick,
  title = "Pegar una lista y cargar todo de golpe",
}: {
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-600 transition-colors hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-400 dark:hover:bg-sky-900/40"
    >
      <ClipboardPaste className="h-3 w-3" />
      Importar
    </button>
  );
}
