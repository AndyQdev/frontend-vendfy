import { useState } from "react";
import { Download, X } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import {
  avisoPospuesto,
  posponerAviso,
  useInstalacion,
} from "../model/instalacion";
import { InstruccionesIOS } from "./InstruccionesIOS";

/**
 * El ofrecimiento discreto de instalar, solo en el teléfono.
 *
 * Una franja al pie, no un modal: el comerciante vino a cobrar, no a instalar
 * nada, y taparle la pantalla con eso es la forma más rápida de que lo cierre
 * para siempre. "Ahora no" lo calla una semana, y el botón del menú del perfil
 * queda igual para quien lo busque.
 */
export function AvisoInstalar() {
  const esMovil = useIsMobile();
  const { puedeInstalar, instalada, ios, instalar } = useInstalacion();

  const [cerrado, setCerrado] = useState(() => avisoPospuesto());
  const [verIOS, setVerIOS] = useState(false);

  // En iOS no hay evento que esperar: se ofrece igual, con instrucciones.
  const hayAlgoQueOfrecer = puedeInstalar || ios;
  if (!esMovil || instalada || cerrado || !hayAlgoQueOfrecer) return null;

  const posponer = () => {
    posponerAviso();
    setCerrado(true);
  };

  const aceptar = async () => {
    if (ios && !puedeInstalar) {
      setVerIOS(true);
      return;
    }
    const acepto = await instalar();
    if (acepto) setCerrado(true);
  };

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card px-4 pt-3 lg:hidden"
        // El gesto de inicio del teléfono vive justo acá abajo: sin esto el
        // botón queda debajo de la barra y no se puede tocar.
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-3">
          <img
            src="/icons/icon-192.png"
            alt=""
            className="size-10 shrink-0 rounded-lg"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Instala Vendfy</p>
            <p className="truncate text-xs text-muted-foreground">
              Se abre como una app, sin la barra del navegador.
            </p>
          </div>

          <Button size="sm" onClick={aceptar} className="shrink-0">
            <Download className="size-4" />
            <span className="ml-1">Instalar</span>
          </Button>

          <button
            type="button"
            onClick={posponer}
            aria-label="Ahora no"
            className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <InstruccionesIOS open={verIOS} onOpenChange={setVerIOS} />
    </>
  );
}
