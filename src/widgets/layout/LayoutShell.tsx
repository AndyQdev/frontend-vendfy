import { Outlet, useLocation } from "react-router-dom";

import { AppHeader } from "@/widgets/app-header";
import { AvisoInstalar } from "@/features/pwa";
import { OnboardingChecklist } from "@/widgets/onboarding";
import { HojaEscaneo, LaserEscaneo, ScannerProvider } from "@/features/scanner";

/**
 * El marco de todas las pantallas del panel: header arriba, contenido abajo.
 *
 * Sin barra lateral: la navegación vive en el carril del header y el contenido
 * gana todo el ancho. La página tiene UN solo scroll vertical —el del
 * documento— y el header queda pegado arriba con `sticky`. Las pantallas que
 * necesitan algo fijo abajo (el campo del asistente) usan `sticky bottom-0`
 * dentro de ese mismo scroll, sin contenedores con scroll propio.
 */
export default function LayoutShell() {
  const location = useLocation();

  return (
    // El escáner vive acá y no en una pantalla: la pistola se escucha en
    // cualquier ruta del panel.
    <ScannerProvider>
      <div className="flex min-h-dvh flex-col bg-background">
        <AppHeader />

        <main className="mx-auto flex w-full min-w-0 max-w-[var(--ancho-maximo)] flex-1 flex-col px-3 pb-6 pt-2 sm:px-6 lg:pt-3">
          {/* La clave reinicia el fundido de entrada en cada cambio de pantalla. */}
          <div key={location.pathname} className="screen-in flex min-w-0 flex-1 flex-col gap-4">
            <Outlet />
          </div>
        </main>

        <OnboardingChecklist />
        <AvisoInstalar />
      </div>
      <LaserEscaneo />
      <HojaEscaneo />
    </ScannerProvider>
  );
}
