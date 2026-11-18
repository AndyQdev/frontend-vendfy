import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/shared/api/client";
import { getChatSocket } from "@/entities/whatsapp/api/chat-socket";
import type {
  Campana,
  CampanaDetalle,
  Embudo,
  EntradaCampana,
  Estimacion,
  EventoLead,
  Lead,
  RespuestaIdeas,
  ResumenMarketing,
} from "../model/types";

const K = {
  resumen: (s?: string, d?: number) => ["marketing", "resumen", s, d],
  ideas: (s?: string) => ["marketing", "ideas", s],
  campanas: (s?: string) => ["marketing", "campanas", s],
  campana: (s?: string, id?: string) => ["marketing", "campana", s, id],
  leads: (s?: string) => ["marketing", "leads", s],
  lead: (s?: string, id?: string) => ["marketing", "lead", s, id],
};

// ------------------------------------------------------------ resumen e ideas

export function useResumenMarketing(storeId?: string, dias = 30) {
  return useQuery({
    queryKey: K.resumen(storeId, dias),
    queryFn: async () => (await apiFetch<ResumenMarketing>(`/api/marketing/resumen?storeId=${storeId}&dias=${dias}`)).data!,
    enabled: !!storeId,
  });
}

export function useIdeas(storeId?: string, opciones: { presupuesto?: number; dias?: number } = {}) {
  const q = new URLSearchParams({ storeId: storeId ?? "" });
  if (opciones.presupuesto) q.set("presupuesto", String(opciones.presupuesto));
  if (opciones.dias) q.set("dias", String(opciones.dias));
  return useQuery({
    queryKey: [...K.ideas(storeId), opciones.presupuesto, opciones.dias],
    queryFn: async () => (await apiFetch<RespuestaIdeas>(`/api/marketing/ideas?${q}`)).data!,
    enabled: !!storeId,
    staleTime: 60_000,
  });
}

export function useEstimar(storeId?: string) {
  return useMutation({
    mutationFn: async (e: { presupuestoDiario: number; dias: number; productos: string[] }) =>
      (await apiFetch<Estimacion>("/api/marketing/estimar", { method: "POST", body: { storeId, ...e } })).data!,
  });
}

// ------------------------------------------------------------ campañas

export function useCampanas(storeId?: string) {
  return useQuery({
    queryKey: K.campanas(storeId),
    queryFn: async () => (await apiFetch<Campana[]>(`/api/marketing/campanas?storeId=${storeId}`)).data ?? [],
    enabled: !!storeId,
  });
}

export function useCampana(storeId?: string, id?: string) {
  return useQuery({
    queryKey: K.campana(storeId, id),
    queryFn: async () => (await apiFetch<CampanaDetalle>(`/api/marketing/campanas/${id}?storeId=${storeId}`)).data!,
    enabled: !!storeId && !!id,
  });
}

function useRefrescarCampanas(storeId?: string) {
  const qc = useQueryClient();
  return (id?: string) => {
    qc.invalidateQueries({ queryKey: K.campanas(storeId) });
    qc.invalidateQueries({ queryKey: ["marketing", "resumen", storeId] });
    if (id) qc.invalidateQueries({ queryKey: K.campana(storeId, id) });
  };
}

export function useCrearCampana(storeId?: string) {
  const refrescar = useRefrescarCampanas(storeId);
  return useMutation({
    mutationFn: async (e: EntradaCampana) =>
      (await apiFetch<Campana>("/api/marketing/campanas", { method: "POST", body: { storeId, ...e } })).data!,
    onSuccess: (c) => refrescar(c?.id),
  });
}

export function useEditarCampana(storeId?: string, id?: string) {
  const qc = useQueryClient();
  const refrescar = useRefrescarCampanas(storeId);
  return useMutation({
    mutationFn: async (e: EntradaCampana) =>
      (await apiFetch<Campana>(`/api/marketing/campanas/${id}`, { method: "PATCH", body: { storeId, ...e } })).data!,
    onSuccess: (c) => {
      // La campaña nueva al instante (con lo que ya había de días y anuncios); después se recarga.
      qc.setQueryData<CampanaDetalle>(K.campana(storeId, id), (prev) => (prev && c ? { ...prev, ...c } : prev));
      refrescar(id);
    },
  });
}

export function useArchivarCampana(storeId?: string) {
  const refrescar = useRefrescarCampanas(storeId);
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/marketing/campanas/${id}?storeId=${storeId}`, { method: "DELETE" });
      return id;
    },
    onSuccess: (id) => refrescar(id),
  });
}

/** Crear en Meta (en pausa), activar, pausar, reanudar: todo pasa por el servidor. */
export function useAccionCampana(storeId?: string, id?: string) {
  const refrescar = useRefrescarCampanas(storeId);
  return useMutation({
    mutationFn: async (accion: "publicar" | "activar" | "pausar" | "sincronizar") =>
      (await apiFetch<Campana>(`/api/marketing/campanas/${id}/${accion}`, { method: "POST", body: { storeId } })).data!,
    onSuccess: () => refrescar(id),
  });
}

export function usePresupuestoCampana(storeId?: string, id?: string) {
  const refrescar = useRefrescarCampanas(storeId);
  return useMutation({
    mutationFn: async (presupuestoDiario: number) =>
      (await apiFetch<Campana>(`/api/marketing/campanas/${id}/presupuesto`, { method: "PATCH", body: { storeId, presupuestoDiario } })).data!,
    onSuccess: () => refrescar(id),
  });
}

export function useImportarCampanas(storeId?: string) {
  const refrescar = useRefrescarCampanas(storeId);
  return useMutation({
    mutationFn: async () =>
      (await apiFetch<{ importadas: number; actualizadas: number }>("/api/marketing/campanas/importar", { method: "POST", body: { storeId } })).data!,
    onSuccess: () => refrescar(),
  });
}

// ------------------------------------------------------------ tablero de chats

export interface FiltrosLeads {
  origen?: string;
  anuncios?: string[];
  q?: string;
  dias?: number;
}

function qsLeads(storeId: string, f: FiltrosLeads) {
  const q = new URLSearchParams({ storeId });
  if (f.origen) q.set("origen", f.origen);
  if (f.anuncios?.length) q.set("anuncios", f.anuncios.join(","));
  if (f.q) q.set("q", f.q);
  if (f.dias) q.set("dias", String(f.dias));
  return q.toString();
}

export function useLeads(storeId?: string, f: FiltrosLeads = {}) {
  return useQuery({
    queryKey: [...K.leads(storeId), f.origen, f.anuncios?.join(","), f.q, f.dias],
    queryFn: async () =>
      (await apiFetch<{ leads: Lead[]; conteo: Record<string, number> }>(`/api/marketing/leads?${qsLeads(storeId!, f)}`)).data!,
    enabled: !!storeId,
  });
}

export function useEmbudoLeads(storeId?: string, f: { anuncios?: string[]; dias?: number } = {}) {
  const q = new URLSearchParams({ storeId: storeId ?? "" });
  if (f.anuncios?.length) q.set("anuncios", f.anuncios.join(","));
  if (f.dias) q.set("dias", String(f.dias));
  return useQuery({
    queryKey: ["marketing", "embudo", storeId, f.anuncios?.join(","), f.dias],
    queryFn: async () => (await apiFetch<Embudo>(`/api/marketing/leads/embudo?${q}`)).data!,
    enabled: !!storeId,
  });
}

export function useLead(storeId?: string, id?: string | null) {
  return useQuery({
    queryKey: K.lead(storeId, id ?? undefined),
    queryFn: async () => (await apiFetch<Lead & { historial: EventoLead[] }>(`/api/marketing/leads/${id}?storeId=${storeId}`)).data!,
    enabled: !!storeId && !!id,
  });
}

export function useEditarLead(storeId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...cambios }: { id: string; etapa?: string; motivo?: string; notas?: string | null; valor?: number | null; responsableId?: string | null }) =>
      (await apiFetch<Lead>(`/api/marketing/leads/${id}`, { method: "PATCH", body: { storeId, ...cambios } })).data!,
    onSuccess: (lead) => {
      ponerLead(qc, storeId, lead);
      qc.invalidateQueries({ queryKey: K.lead(storeId, lead.id) });
    },
  });
}

/** Reemplaza (o agrega) un lead en todas las listas del tablero que estén en caché. */
function ponerLead(qc: ReturnType<typeof useQueryClient>, storeId: string | undefined, lead: Lead) {
  qc.setQueriesData<{ leads: Lead[]; conteo: Record<string, number> }>({ queryKey: K.leads(storeId) }, (prev) => {
    if (!prev) return prev;
    const antes = prev.leads.find((l) => l.id === lead.id);
    const leads = antes ? prev.leads.map((l) => (l.id === lead.id ? lead : l)) : [lead, ...prev.leads];
    const conteo = { ...prev.conteo };
    if (antes && antes.etapa !== lead.etapa) conteo[antes.etapa] = Math.max(0, (conteo[antes.etapa] ?? 1) - 1);
    if (!antes || antes.etapa !== lead.etapa) conteo[lead.etapa] = (conteo[lead.etapa] ?? 0) + 1;
    return { leads, conteo };
  });
}

/** El tablero se mueve en vivo: cada cambio de etapa llega por el socket del inbox. */
export function useLeadsEnVivo(storeId?: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!storeId) return;
    const socket = getChatSocket();
    const token = localStorage.getItem("authToken") || "";
    const join = () => socket.emit("join", { storeId, token });
    const onLead = (lead: Lead) => {
      ponerLead(qc, storeId, lead);
      qc.invalidateQueries({ queryKey: ["marketing", "embudo", storeId] });
      qc.invalidateQueries({ queryKey: ["marketing", "resumen", storeId] });
    };
    socket.on("connect", join);
    socket.on("crm:lead", onLead);
    if (socket.connected) join();
    return () => {
      socket.off("connect", join);
      socket.off("crm:lead", onLead);
    };
  }, [storeId, qc]);
}
