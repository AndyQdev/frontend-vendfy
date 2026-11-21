import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/shared/api/client";
import type {
  Conocimiento,
  CorridaDetalle,
  CorridaPrueba,
  DerivacionTienda,
  FichaProducto,
  FichaTienda,
  PreguntaSinRespuesta,
  VozTienda,
} from "../model/types";

const K = {
  conocimiento: (s?: string) => ["agente", "conocimiento", s],
  preguntas: (s?: string) => ["agente", "preguntas", s],
  pruebas: (s?: string) => ["agente", "pruebas", s],
  corrida: (s?: string, id?: string) => ["agente", "corrida", s, id],
};

/** Lo que el agente sabe de la tienda. Si hay una generación masiva en curso, se refresca solo. */
export function useConocimiento(storeId?: string) {
  return useQuery({
    queryKey: K.conocimiento(storeId),
    queryFn: async () => (await apiFetch<Conocimiento>(`/api/agent/conocimiento/${storeId}`)).data!,
    enabled: !!storeId,
    refetchInterval: (q) => {
      const g = q.state.data?.generando;
      return g && g.hechos + g.errores < g.total ? 4000 : false;
    },
  });
}

export function useGuardarTienda(storeId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { ficha?: FichaTienda; voz?: VozTienda; derivacion?: DerivacionTienda }) =>
      (await apiFetch<Conocimiento>(`/api/agent/conocimiento/${storeId}/tienda`, { method: "PATCH", body })).data!,
    onSuccess: (data) => qc.setQueryData(K.conocimiento(storeId), data),
  });
}

export function useGuardarFicha(storeId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { productId: string; ficha: Partial<FichaProducto>; aprobar?: boolean }) =>
      (
        await apiFetch<FichaProducto>(`/api/agent/conocimiento/${storeId}/productos/${v.productId}`, {
          method: "PATCH",
          body: { ficha: v.ficha, aprobar: v.aprobar },
        })
      ).data!,
    onSuccess: () => qc.invalidateQueries({ queryKey: K.conocimiento(storeId) }),
  });
}

export function useGenerarFicha(storeId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) =>
      (await apiFetch<FichaProducto>(`/api/agent/conocimiento/${storeId}/productos/${productId}/generar`, { method: "POST" })).data!,
    onSuccess: () => qc.invalidateQueries({ queryKey: K.conocimiento(storeId) }),
  });
}

export function useGenerarTodas(storeId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (soloSinFicha: boolean) =>
      (await apiFetch(`/api/agent/conocimiento/${storeId}/generar-todas`, { method: "POST", body: { soloSinFicha } })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: K.conocimiento(storeId) }),
  });
}

export function useAprobarFichas(storeId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (productIds: string[]) =>
      (await apiFetch<{ aprobadas: number }>(`/api/agent/conocimiento/${storeId}/aprobar`, { method: "POST", body: { productIds } })).data!,
    onSuccess: () => qc.invalidateQueries({ queryKey: K.conocimiento(storeId) }),
  });
}

// ------------------------------------------------------------ preguntas

export function usePreguntas(storeId?: string) {
  return useQuery({
    queryKey: K.preguntas(storeId),
    queryFn: async () => (await apiFetch<PreguntaSinRespuesta[]>(`/api/agent/conocimiento/${storeId}/preguntas`)).data ?? [],
    enabled: !!storeId,
  });
}

export function useResponderPregunta(storeId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; respuesta: string }) =>
      (
        await apiFetch<PreguntaSinRespuesta[]>(`/api/agent/conocimiento/${storeId}/preguntas/${v.id}/responder`, {
          method: "POST",
          body: { respuesta: v.respuesta },
        })
      ).data ?? [],
    onSuccess: (data) => {
      qc.setQueryData(K.preguntas(storeId), data);
      qc.invalidateQueries({ queryKey: K.conocimiento(storeId) });
    },
  });
}

export function useDescartarPregunta(storeId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await apiFetch<PreguntaSinRespuesta[]>(`/api/agent/conocimiento/${storeId}/preguntas/${id}/descartar`, { method: "POST" })).data ?? [],
    onSuccess: (data) => {
      qc.setQueryData(K.preguntas(storeId), data);
      qc.invalidateQueries({ queryKey: K.conocimiento(storeId) });
    },
  });
}

// -------------------------------------------------------------- pruebas

/** Las corridas de «Probar mi agente». Mientras una corre, se consulta cada 5 s. */
export function usePruebas(storeId?: string) {
  return useQuery({
    queryKey: K.pruebas(storeId),
    queryFn: async () => (await apiFetch<CorridaPrueba[]>(`/api/agent/pruebas/${storeId}`)).data ?? [],
    enabled: !!storeId,
    refetchInterval: (q) => ((q.state.data ?? []).some((c) => c.estado === "corriendo") ? 5000 : false),
  });
}

export function useIniciarPrueba(storeId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (op: { provider?: string; model?: string; repeticiones?: number; usarBorradores?: boolean } = {}) =>
      (await apiFetch<{ id: string }>(`/api/agent/pruebas/${storeId}`, { method: "POST", body: op })).data!,
    onSuccess: () => qc.invalidateQueries({ queryKey: K.pruebas(storeId) }),
  });
}

export function useCorrida(storeId?: string, id?: string) {
  return useQuery({
    queryKey: K.corrida(storeId, id),
    queryFn: async () => (await apiFetch<CorridaDetalle>(`/api/agent/pruebas/${storeId}/${id}`)).data!,
    enabled: !!storeId && !!id,
  });
}
