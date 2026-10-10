import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/shared/api/client";

export interface VozDisponible {
  id: string;
  nombre: string;
  genero: "femenina" | "masculina";
  tono: string;
}

export interface EstadoVoces {
  /** false: el servidor no tiene la voz natural; habla la del navegador. */
  disponible: boolean;
  voces: VozDisponible[];
  porDefecto: string;
}

/** Las voces que ofrece el servidor. Cambian con un deploy, no durante la sesión. */
export function useVoces() {
  return useQuery({
    queryKey: ["voz", "voces"],
    queryFn: async () => (await apiFetch<EstadoVoces>("/api/voz/voces")).data!,
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
  });
}
