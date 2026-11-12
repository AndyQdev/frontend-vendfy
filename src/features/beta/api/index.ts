import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/shared/api/client";

/** Espejo de `EstadoBeta` en ecomerce-backend/src/beta/services/beta.service.ts. */
export interface EstadoBeta {
  participa: boolean;
  cohorte: { id: string; nombre: string; estado: string } | null;
  consentimiento: string | null;
  textoConsentimiento: { version: string; titulo: string; puntos: string[] } | null;
  encuesta: { momento: "dia14" | "cierre"; preguntasSus: string[]; preguntaNps: string } | null;
}

export interface RespuestaEncuesta {
  storeId: string;
  momento: "dia14" | "cierre";
  sus: number[];
  nps: number;
  comentario?: string;
}

export function useResponderEncuesta(storeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: RespuestaEncuesta) =>
      (await apiFetch<{ sus: number; nps: number }>("/api/beta/encuestas", { method: "POST", body: r })).data!,
    // Contestada, deja de estar pendiente.
    onSuccess: () => qc.invalidateQueries({ queryKey: clave(storeId) }),
  });
}

export interface ReporteBeta {
  storeId: string;
  tipo: "problema" | "sugerencia";
  titulo: string;
  descripcion?: string;
  gravedad?: "baja" | "media" | "alta";
  url?: string;
}

const clave = (storeId: string | undefined) => ["beta", "estado", storeId] as const;

/** Si la tienda está en una beta. Se pregunta poco: cambia una vez por beta. */
export function useEstadoBeta(storeId: string | undefined) {
  return useQuery({
    queryKey: clave(storeId),
    queryFn: async () => (await apiFetch<EstadoBeta>(`/api/beta/estado?storeId=${storeId}`)).data!,
    enabled: Boolean(storeId),
    staleTime: 10 * 60_000,
    // Si falla (backend viejo, sin red), el panel sigue como si no hubiera beta.
    retry: false,
  });
}

export function useAceptarBeta(storeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await apiFetch<EstadoBeta>("/api/beta/consentimiento", { method: "POST", body: { storeId } })).data!,
    onSuccess: (estado) => qc.setQueryData(clave(storeId), estado),
  });
}

export function useReportarBeta() {
  return useMutation({
    mutationFn: async (r: ReporteBeta) => (await apiFetch<{ id: string }>("/api/beta/reportes", { method: "POST", body: r })).data!,
  });
}
