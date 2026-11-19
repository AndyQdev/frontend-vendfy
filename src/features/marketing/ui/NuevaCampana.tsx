import { toast } from "sonner";
import { Download } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/shared/ui/responsive-dialog";
import { Button } from "@/shared/ui/button";
import { useImportarCampanas } from "@/entities/marketing/api";
import { IdeasMarketing } from "./IdeasMarketing";

/** Nueva campaña: las ideas que salen de los datos de la tienda, o traer las que ya están en Meta. */
export function NuevaCampana({
  storeId,
  open,
  onOpenChange,
  puedeGestionar,
}: {
  storeId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  puedeGestionar: boolean;
}) {
  const importar = useImportarCampanas(storeId);
  const traer = async () => {
    try {
      const r = await importar.mutateAsync();
      toast.success(
        r.importadas || r.actualizadas ? `Traje ${r.importadas} campañas nuevas y actualicé ${r.actualizadas}` : "No hay campañas nuevas en tu cuenta de Meta",
      );
      if (r.importadas) onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo leer Meta");
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-5xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Nueva campaña</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Elige una idea: se arma un borrador que revisas antes de crearlo en Meta. Nada gasta hasta que tú lo actives.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody className="space-y-4">
          {puedeGestionar && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm">
              <span className="text-muted-foreground">¿Ya tienes campañas hechas en Meta? Tráelas para ver sus chats y su retorno aquí.</span>
              <Button variant="outline" size="sm" onClick={traer} loading={importar.isPending}>
                <Download className="mr-1.5 h-4 w-4" /> Traer de Meta
              </Button>
            </div>
          )}
          <IdeasMarketing storeId={storeId} puedeGestionar={puedeGestionar} />
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
