import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardPaste, Check, RefreshCw } from "lucide-react";
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
import { parsearEspecificaciones } from "@/entities/product/model/especificaciones";

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

/**
 * Pegar una lista y que se convierta en especificaciones.
 *
 * Se interpreta mientras se escribe y se muestra el resultado ANTES de
 * importar: pegar texto de un formato incierto y que algo se guarde solo es
 * incómodo, y ver los diez renglones ya separados en nombre y valor es la
 * confirmación de que se leyó lo que se quería.
 */
export function ImportarEspecificacionesModal({
  open,
  onOpenChange,
  existentes,
  onImportar,
}: Props) {
  const [texto, setTexto] = useState("");

  // Cada apertura empieza en blanco: lo que se pegó la vez pasada ya se importó.
  useEffect(() => {
    if (open) setTexto("");
  }, [open]);

  const resultado = useMemo(() => parsearEspecificaciones(texto), [texto]);
  const { pares, formato, error } = resultado;

  const reemplazos = pares.filter((p) => p.clave in existentes).length;
  const nuevas = pares.length - reemplazos;

  const importar = () => {
    if (pares.length === 0) return;
    const mapa: Record<string, string> = {};
    for (const par of pares) mapa[par.clave] = par.valor;
    onImportar(mapa);
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[560px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Importar especificaciones</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Pegá la lista como la tengas: JSON, una por línea, o copiada de una
            planilla. Se separa sola en nombre y valor.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-4 py-2">
          <Textarea
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={EJEMPLO}
            spellCheck={false}
            className="min-h-[180px] font-mono text-xs leading-relaxed"
          />

          {texto.trim() === "" ? (
            <p className="text-xs text-muted-foreground">
              También entienden <code className="font-mono">Nombre = valor</code>,
              tabulaciones y tablas de markdown. Si la columna se llama
              "porcentaje", el símbolo <code className="font-mono">%</code> se
              agrega solo.
            </p>
          ) : error && pares.length === 0 ? (
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
                  <Check className="h-3.5 w-3.5" />
                  {pares.length}{" "}
                  {pares.length === 1 ? "especificación" : "especificaciones"}
                  {formato && (
                    <span className="font-normal text-muted-foreground">
                      · leído como {formato}
                    </span>
                  )}
                </span>
                {reemplazos > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                    <RefreshCw className="h-3.5 w-3.5" />
                    {reemplazos} {reemplazos === 1 ? "reemplaza" : "reemplazan"} a
                    {reemplazos === 1 ? " una" : " las"} que ya {reemplazos === 1 ? "está" : "están"} cargada{reemplazos === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              {error && (
                <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                  {error}
                </p>
              )}

              <ul className="max-h-[220px] space-y-1 overflow-y-auto rounded-xl border border-border/60 p-2">
                {pares.map((par) => {
                  const reemplaza = par.clave in existentes;
                  return (
                    <li
                      key={par.clave}
                      className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-sm odd:bg-muted/40"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {par.clave}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {par.valor}
                      </span>
                      {reemplaza && (
                        <RefreshCw
                          className="h-3 w-3 shrink-0 text-amber-500"
                          aria-label="Reemplaza a una existente"
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={importar} disabled={pares.length === 0}>
            <ClipboardPaste className="mr-2 h-4 w-4" />
            {pares.length === 0
              ? "Importar"
              : reemplazos > 0
                ? `Importar ${pares.length} (${nuevas} nuevas)`
                : `Importar ${pares.length}`}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
