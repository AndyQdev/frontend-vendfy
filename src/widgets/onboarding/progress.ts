import { useAuth } from "@/app/providers/auth";
import { useStores } from "@/entities/store/api";
import { TOTAL_ONBOARDING_STEPS } from "@/entities/user/api/onboarding";

/**
 * Cuántos pasos de la guía de primeros pasos lleva hechos el usuario.
 *
 * El paso 1 (crear la tienda) se da por hecho si ya tiene alguna: los usuarios
 * viejos la crearon antes de que existiera la guía y nunca se les marcó.
 */
export function useOnboardingProgress() {
  const { user } = useAuth();
  const { data: stores } = useStores();

  const completed = new Set<number>(user?.onboardingSteps || []);
  if ((stores?.length ?? 0) > 0) completed.add(1);

  const done = completed.size;
  return {
    completed,
    done,
    total: TOTAL_ONBOARDING_STEPS,
    remaining: Math.max(0, TOTAL_ONBOARDING_STEPS - done),
    finished: done >= TOTAL_ONBOARDING_STEPS,
  };
}
