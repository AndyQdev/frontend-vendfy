import { RefreshCw } from "lucide-react";
import { ImportarModal } from "@/shared/ui/importar-modal";
import {
  parsearEspecificaciones,
  type ParEspecificacion,
} from "@/entities/product/model/especificaciones";

const EJEMPLO = `[
  { "nombre": "Amaderado", "porcentaje": 22 },
  { "nombre": "Cuero", "porcentaje": 16 }
]

o también:

Amaderado: 22%
Cuero: 16%`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lo que ya tiene el producto, para avisar qué se va a reemplazar. */
  existentes: Record<string, string>;
  onImportar: (especificaciones: Record<string, string>) => void;
}

export function ImportarEspecificacionesModal({
  open,
  onOpenChange,
  existentes,
  onImportar,
}: Props) {
  const cuantosReemplazan = (pares: ParEspecificacion[]) =>
    pares.filter((p) => p.clave in existentes).length;

  return (
    <ImportarModal<ParEspecificacion>
      open={open}
      onOpenChange={onOpenChange}
      titulo="Importar especificaciones"
      descripcion="Pega la lista como la tengas: JSON, una por línea, o copiada de una planilla. Se separa sola en nombre y valor."
      placeholder={EJEMPLO}
      ayuda={
        <>
          También entienden <code className="font-mono">Nombre = valor</code>,
          tabulaciones y tablas de markdown. Si la columna se llama "porcentaje",
          el símbolo <code className="font-mono">%</code> se agrega solo.
        </>
      }
      parsear={parsearEspecificaciones}
      etiquetaAccion={(pares) =>
        pares.length === 1
          ? "Importar 1 especificación"
          : `Importar ${pares.length} especificaciones`
      }
      aviso={(pares) => {
        const n = cuantosReemplazan(pares);
        if (n === 0) return null;
        return (
          <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
            <RefreshCw className="h-3.5 w-3.5" />
            {n === 1
              ? "1 reemplaza a una que ya está cargada"
              : `${n} reemplazan a las que ya están cargadas`}
          </span>
        );
      }}
      renderPreview={(pares) => (
        <ul className="space-y-1">
          {pares.map((par) => (
            <li
              key={par.clave}
              className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-sm odd:bg-muted/40"
            >
              <span className="min-w-0 flex-1 truncate font-medium">
                {par.clave}
              </span>
              <span className="shrink-0 text-muted-foreground">{par.valor}</span>
              {par.clave in existentes && (
                <RefreshCw
                  className="h-3 w-3 shrink-0 text-amber-500"
                  aria-label="Reemplaza a una existente"
                />
              )}
            </li>
          ))}
        </ul>
      )}
      onConfirmar={(pares) => {
        const mapa: Record<string, string> = {};
        for (const par of pares) mapa[par.clave] = par.valor;
        onImportar(mapa);
      }}
    />
  );
}
