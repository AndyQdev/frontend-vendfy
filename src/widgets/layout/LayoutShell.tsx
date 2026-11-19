import { Outlet, useLocation } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

import { useAcceso } from "@/app/providers/acceso";
import { AppHeader, primeraRuta, requisitoDe } from "@/widgets/app-header";
import { CambiarClaveObligatoria, SinAcceso } from "@/features/acceso";
import { ConsentimientoBeta, EncuestaBeta } from "@/features/beta";
import { AvisoInstalar } from "@/features/pwa";
import { OnboardingChecklist } from "@/widgets/onboarding";
import { HojaEscaneo, LaserEscaneo, ScannerProvider, VentaFlotante } from "@/features/scanner";
import { PilotoVendfy } from "@/features/piloto";

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
  const { acceso, esDueno, motivo, cumple } = useAcceso();

  // Con la contraseña que le dio el dueño, primero elige la suya.
  if (acceso?.debeCambiarClave) return <CambiarClaveObligatoria />;

  // Si entró por la dirección a una pantalla que su rol o su plan no tienen.
  const ruta = requisitoDe(location.pathname);
  const bloqueo = ruta ? motivo(ruta.requiere) : "ok";

  return (
    // El escáner vive acá y no en una pantalla: la pistola se escucha en
    // cualquier ruta del panel.
    <ScannerProvider>
      <div className="flex min-h-dvh flex-col bg-background">
        <AppHeader />

        {acceso?.suspendida ? (
          <div className="mx-auto mt-2 flex w-full max-w-[var(--ancho-maximo)] items-center gap-2 px-3 sm:px-6">
            <p className="flex w-full items-center gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
              <AlertTriangle className="size-4 flex-none" />
              La suscripción de tu negocio está suspendida: puedes ver tus datos, pero no hacer cambios. Escríbenos para reactivarla.
            </p>
          </div>
        ) : null}

        <main className="mx-auto flex w-full min-w-0 max-w-[var(--ancho-maximo)] flex-1 flex-col px-3 pb-6 pt-2 sm:px-6 lg:pt-3">
          {/* La clave reinicia el fundido de entrada en cada cambio de pantalla. */}
          <div key={location.pathname} className="screen-in flex min-w-0 flex-1 flex-col gap-4">
            {bloqueo === "ok" ? (
              <Outlet />
            ) : (
              <SinAcceso
                motivo={bloqueo}
                requisito={ruta?.requiere}
                pantalla={ruta?.label}
                negocio={acceso?.negocio.name}
                inicio={primeraRuta(cumple)}
              />
            )}
          </div>
        </main>

        {/* La guía de primeros pasos es del dueño: el empleado entra a un negocio ya armado. */}
        {esDueno ? <OnboardingChecklist /> : null}
        <AvisoInstalar />
        {/* Pide aceptar la participación a las tiendas que están en una beta.
            Aceptar y contestar la encuesta lo hace el dueño, no su equipo. */}
        {esDueno ? <ConsentimientoBeta /> : null}
        {/* Y su encuesta (SUS + NPS) a las dos semanas y al cierre. */}
        {esDueno ? <EncuestaBeta /> : null}
      </div>
      <LaserEscaneo />
      <HojaEscaneo />
      <VentaFlotante />
      {/* "Vendfy": manejar el panel hablando (botón abajo a la izquierda o F9). */}
      <PilotoVendfy />
    </ScannerProvider>
  );
}
