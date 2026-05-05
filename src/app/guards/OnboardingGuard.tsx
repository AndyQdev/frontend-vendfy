import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/app/providers/auth";
import { useStores } from "@/entities/store/api";
import VendfyLoader from "@/shared/loading/VendfyLoader";

/**
 * Bloquea el acceso a rutas internas hasta que el usuario complete el onboarding básico
 * y tenga al menos una tienda creada. Redirige a /onboarding mientras tanto.
 */
export function OnboardingGuard() {
  const { user } = useAuth();
  const location = useLocation();
  const { data: stores, isLoading } = useStores();

  if (isLoading) {
    const stored = localStorage.getItem("theme");
    const isDark =
      stored === "dark" ||
      (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    return <VendfyLoader theme={isDark ? "dark" : "light"} message="Cargando tu espacio..." />;
  }

  const hasStore = (stores?.length ?? 0) > 0;
  const onboardingDone = user?.onboardingBasic === true;
  const needsOnboarding = !hasStore || !onboardingDone;

  if (needsOnboarding && !location.pathname.startsWith("/onboarding")) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!needsOnboarding && location.pathname.startsWith("/onboarding")) {
    return <Navigate to="/caja" replace />;
  }

  return <Outlet />;
}
