import { useMutation, useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/shared/api/client";
import type { IntencionDisponible, Propuesta } from "../model/types";

export function useIntenciones() {
  return useQuery({
    queryKey: ["omnibox", "intenciones"],
    queryFn: async () =>
      (await apiFetch<IntencionDisponible[]>("/api/omnibox/intenciones")).data,
    // El catálogo sale del código del backend: solo cambia con un despliegue.
    staleTime: Infinity,
  });
}

export function useInterpretar() {
  return useMutation({
    mutationFn: async (vars: { texto: string; storeId: string }) =>
      (
        await apiFetch<Propuesta>("/api/omnibox/interpretar", {
          method: "POST",
          body: vars,
        })
      ).data,
  });
}

export function useConfirmar() {
  return useMutation({
    mutationFn: async (vars: {
      intencion: string;
      entidades: Record<string, unknown>;
      storeId: string;
    }) =>
      (
        await apiFetch<{ resumen: string; datos?: any }>("/api/omnibox/confirmar", {
          method: "POST",
          body: vars,
        })
      ).data,
  });
}
