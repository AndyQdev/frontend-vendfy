import { Share, SquarePlus } from "lucide-react";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogBody,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/shared/ui/responsive-dialog";

/**
 * Cómo instalar en iPhone y iPad.
 *
 * Safari no dispara `beforeinstallprompt`, así que no hay botón que apretar:
 * lo único honesto es mostrar los dos pasos. Va como hoja porque en iOS esto
 * se lee siempre desde el teléfono.
 */
export function InstruccionesIOS({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Instalar Vendfy</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            En iPhone y iPad se agrega desde Safari, en dos pasos.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody>
          <ol className="space-y-4 py-2">
          <li className="flex items-start gap-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-soft-foreground">
              <Share className="size-4" />
            </span>
            <p className="text-sm">
              Tocá <strong>Compartir</strong>, el cuadrado con la flecha hacia
              arriba en la barra de Safari.
            </p>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-soft-foreground">
              <SquarePlus className="size-4" />
            </span>
            <p className="text-sm">
              Bajá hasta <strong>Agregar a inicio</strong> y confirmá.
            </p>
          </li>
          </ol>

          <p className="pb-4 text-xs text-muted-foreground">
            Queda como una aplicación más, con su ícono y sin la barra del
            navegador.
          </p>
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
