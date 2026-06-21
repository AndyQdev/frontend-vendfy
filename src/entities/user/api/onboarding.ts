import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/shared/api/client";

export const ONBOARDING_STEPS = {
  STORE_CREATED: 1,
  FIRST_PRODUCT: 2,
  FIRST_PURCHASE: 3,
  FIRST_SALE: 4,
  STORE_PERSONALIZED: 5,
  STORE_VISITED: 6,
} as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[keyof typeof ONBOARDING_STEPS];

export const TOTAL_ONBOARDING_STEPS = 6;

interface CompleteStepResponse {
  onboardingSteps: number[];
}

/**
 * Marca un paso del onboarding como completado para el usuario autenticado.
 * Es idempotente: si ya está marcado, el backend lo ignora silenciosamente.
 */
export function useCompleteOnboardingStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (step: OnboardingStep) => {
      const response = await apiFetch<CompleteStepResponse>(
        `/api/user/onboarding/step/${step}`,
        { method: "POST" },
      );
      return response.data?.onboardingSteps ?? [];
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth-user"] });
    },
  });
}

/**
 * Helper imperativo para marcar un paso sin React Query (ej: dentro de mutaciones existentes).
 * No falla la operación principal si esto falla.
 */
export async function markOnboardingStep(step: OnboardingStep): Promise<void> {
  try {
    await apiFetch(`/api/user/onboarding/step/${step}`, { method: "POST" });
  } catch {
    // No bloquear la acción principal si falla el tracking
  }
}
