import { useState } from "react";
import { Check, FlaskConical, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useStore } from "@/app/providers/auth";
import { Button } from "@/shared/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/shared/ui/responsive-dialog";

import { useAceptarBeta, useEstadoBeta } from "../api";

/** "Ahora no" vale por la sesión: vuelve a preguntar la próxima vez que entre. */
const CLAVE_POSPUESTO = "beta.consentimiento.pospuesto";

/**
 * La primera vez que entra una tienda que está en una beta, se le cuenta qué
 * significa y se le pide aceptar. Queda la fecha y la versión del texto: es lo
 * que permite usar sus datos (anónimos) en la investigación.
 */
export function ConsentimientoBeta() {
  const { selectedStore } = useStore();
  const tienda = selectedStore && selectedStore !== "all" ? selectedStore : null;
  const { data } = useEstadoBeta(tienda?.id);
  const aceptar = useAceptarBeta(tienda?.id);
  const [pospuesto, setPospuesto] = useState(() => {
    try {
      return sessionStorage.getItem(CLAVE_POSPUESTO) === tienda?.id;
    } catch {
      return false;
    }
  });

  const texto = data?.participa ? data.textoConsentimiento : null;
  if (!tienda || !texto || pospuesto) return null;

  const posponer = () => {
    try {
      sessionStorage.setItem(CLAVE_POSPUESTO, tienda.id);
    } catch {
      /* sin almacenamiento, vuelve a preguntar al recargar */
    }
    setPospuesto(true);
  };

  return (
    <ResponsiveDialog open onOpenChange={(v) => !v && posponer()}>
      <ResponsiveDialogContent className="sm:max-w-[520px]">
        <ResponsiveDialogHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FlaskConical className="size-5" />
          </span>
          <ResponsiveDialogTitle>{texto.titulo}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {tienda.name} está en la <b>{data!.cohorte?.nombre}</b>. Antes de seguir, esto es lo que significa:
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>
          <ul className="space-y-2.5">
            {texto.puntos.map((p) => (
              <li key={p} className="flex gap-2.5 text-sm">
                <Check className="mt-0.5 size-4 flex-none text-primary" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button variant="ghost" onClick={posponer}>
            Ahora no
          </Button>
          <Button
            disabled={aceptar.isPending}
            className="gap-2"
            onClick={async () => {
              try {
                await aceptar.mutateAsync();
                toast.success("¡Gracias por sumarte a la beta! Si algo falla, usá el botón Reportar de arriba.");
              } catch (e: any) {
                toast.error(e?.message ?? "No se pudo guardar. Probá de nuevo.");
              }
            }}
          >
            {aceptar.isPending && <Loader2 className="size-4 animate-spin" />}
            Acepto participar
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
