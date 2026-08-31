import { Tag } from "lucide-react";
import { ImportarModal } from "@/shared/ui/importar-modal";
import {
  parsearEtiquetas,
  normalizarEtiqueta,
} from "@/entities/product/model/etiquetas";

const EJEMPLO = `["perfume", "masculino", "elegante", "amaderado"]

o también:

perfume, masculino, elegante
#premium #noche`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Las que ya tiene el producto, para no repetirlas. */
  existentes: string[];
  onImportar: (etiquetas: string[]) => void;
}

export function ImportarEtiquetasModal({
  open,
  onOpenChange,
  existentes,
  onImportar,
}: Props) {
  const yaEstan = new Set(existentes.map(normalizarEtiqueta));
  const esRepetida = (etiqueta: string) => yaEstan.has(normalizarEtiqueta(etiqueta));

  return (
    <ImportarModal<string>
      open={open}
      onOpenChange={onOpenChange}
      titulo="Importar etiquetas"
      descripcion="Pegá las etiquetas como las tengas: un arreglo JSON, separadas por comas, una por línea o como hashtags."
      placeholder={EJEMPLO}
      ayuda={
        <>
          Se comparan sin acentos ni mayúsculas, así que "Premium" y "premium" no
          entran dos veces. Las que ya tenga el producto se muestran en gris y se
          saltean.
        </>
      }
      parsear={parsearEtiquetas}
      etiquetaAccion={(etiquetas) => {
        const nuevas = etiquetas.filter((e) => !esRepetida(e)).length;
        if (nuevas === 0) return "Ya están todas agregadas";
        return nuevas === 1 ? "Importar 1 etiqueta" : `Importar ${nuevas} etiquetas`;
      }}
      puedeConfirmar={(etiquetas) => etiquetas.some((e) => !esRepetida(e))}
      aviso={(etiquetas) => {
        const repetidas = etiquetas.filter(esRepetida).length;
        if (repetidas === 0) return null;
        return (
          <span className="text-muted-foreground">
            {repetidas === 1
              ? "1 ya está en el producto y se saltea"
              : `${repetidas} ya están en el producto y se saltean`}
          </span>
        );
      }}
      renderPreview={(etiquetas) => (
        <div className="flex flex-wrap gap-1.5 p-1">
          {etiquetas.map((etiqueta) => {
            const repetida = esRepetida(etiqueta);
            return (
              <span
                key={etiqueta}
                title={repetida ? "Ya está en el producto" : undefined}
                className={
                  repetida
                    ? "inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-sm text-muted-foreground line-through"
                    : "inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                }
              >
                <Tag className="h-3 w-3" />
                {etiqueta}
              </span>
            );
          })}
        </div>
      )}
      onConfirmar={(etiquetas) => {
        // Las repetidas se filtran acá y no en el parser: en la previa tienen
        // que verse tachadas para que se entienda por qué no entran.
        onImportar(etiquetas.filter((e) => !esRepetida(e)));
      }}
    />
  );
}
