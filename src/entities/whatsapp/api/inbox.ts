import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/shared/api/client";
import { toast } from "sonner";
import type { Conversation, ChatMessage } from "../model/inbox-types";
import type { WhatsAppKapsoInfo } from "../model/types";

// ===== Inbox (conversaciones / mensajes) =====

export function useConversations(storeId: string | undefined) {
  return useQuery<Conversation[]>({
    queryKey: ["inbox-conversations", storeId],
    queryFn: async () => {
      const res = await apiFetch<Conversation[]>(
        `/api/inbox/conversations?storeId=${storeId}`,
      );
      return res.data ?? [];
    },
    enabled: !!storeId,
  });
}

export function useMessages(
  storeId: string | undefined,
  contactPhone: string | undefined,
) {
  return useQuery<ChatMessage[]>({
    queryKey: ["inbox-messages", storeId, contactPhone],
    queryFn: async () => {
      const res = await apiFetch<ChatMessage[]>(
        `/api/inbox/messages?storeId=${storeId}&contactPhone=${encodeURIComponent(
          contactPhone!,
        )}`,
      );
      return res.data ?? [];
    },
    enabled: !!storeId && !!contactPhone,
  });
}

export function useSendInboxMessage() {
  return useMutation({
    mutationFn: async (vars: {
      storeId: string;
      contactPhone: string;
      content: string;
    }) => {
      const res = await apiFetch<ChatMessage>("/api/inbox/send", {
        method: "POST",
        body: vars,
      });
      return res.data!;
    },
    onError: (error: Error) => {
      toast.error(
        error instanceof ApiError ? error.message : "Error al enviar el mensaje",
      );
    },
  });
}

export function useTakeover() {
  return useMutation({
    mutationFn: async (vars: { storeId: string; conversationId: string }) => {
      const res = await apiFetch<Conversation>("/api/inbox/takeover", {
        method: "POST",
        body: vars,
      });
      return res.data!;
    },
  });
}

export function useRelease() {
  return useMutation({
    mutationFn: async (vars: { storeId: string; conversationId: string }) => {
      const res = await apiFetch<Conversation>("/api/inbox/release", {
        method: "POST",
        body: vars,
      });
      return res.data!;
    },
  });
}

export function useMarkRead() {
  return useMutation({
    mutationFn: async (vars: { storeId: string; conversationId: string }) => {
      await apiFetch("/api/inbox/read", { method: "POST", body: vars });
    },
  });
}

// ===== Conexión Kapso =====

export function useKapsoStatus(storeId: string | undefined) {
  return useQuery<WhatsAppKapsoInfo | null>({
    queryKey: ["kapso-status", storeId],
    queryFn: async () => {
      const res = await apiFetch<WhatsAppKapsoInfo | null>(
        `/api/kapso/status/${storeId}`,
      );
      return res.data ?? null;
    },
    enabled: !!storeId,
  });
}

export function useKapsoConnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { storeId: string; businessName?: string }) => {
      const res = await apiFetch<{ setupUrl: string; customer_id: string }>(
        "/api/kapso/connect",
        { method: "POST", body: vars },
      );
      return res.data!;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["kapso-status", vars.storeId] });
    },
    onError: (error: Error) => {
      toast.error(
        error instanceof ApiError ? error.message : "Error al conectar WhatsApp",
      );
    },
  });
}

// ===== Chat de prueba del agente (sandbox) =====

/** Envía un mensaje o el tap de un botón al agente, sin tocar WhatsApp. */
export function useSandboxSend() {
  return useMutation({
    mutationFn: async (vars: {
      storeId: string;
      text?: string;
      buttonId?: string;
      buttonTitle?: string;
    }) => {
      const res = await apiFetch<{ reply: string | null }>(
        `/api/agent/sandbox/${vars.storeId}`,
        {
          method: "POST",
          body: {
            text: vars.text,
            buttonId: vars.buttonId,
            buttonTitle: vars.buttonTitle,
          },
        },
      );
      return res.data!;
    },
    onError: (error: Error) => {
      toast.error(
        error instanceof ApiError ? error.message : "El agente no pudo responder",
      );
    },
  });
}

/** Vacía la conversación de prueba (mensajes + carrito del agente). */
export function useClearSandbox() {
  return useMutation({
    mutationFn: async (vars: { storeId: string }) => {
      const res = await apiFetch<{ deleted: number }>(
        `/api/agent/sandbox/${vars.storeId}`,
        { method: "DELETE" },
      );
      return res.data!;
    },
    onError: (error: Error) => {
      toast.error(
        error instanceof ApiError ? error.message : "No se pudo vaciar el chat",
      );
    },
  });
}

export function useKapsoSetupLink() {
  return useMutation({
    mutationFn: async (vars: { storeId: string }) => {
      const res = await apiFetch<{ setupUrl: string }>("/api/kapso/setup-link", {
        method: "POST",
        body: vars,
      });
      return res.data!;
    },
    onError: (error: Error) => {
      toast.error(
        error instanceof ApiError ? error.message : "Error generando el enlace",
      );
    },
  });
}

// ===== Notificaciones (templates + número externo) =====

export interface WaTemplateOverview {
  name: string;
  label: string;
  event: string;
  body: string;
  params: Array<{ param_name: string; example: string }>;
  buttons: Array<{ type: "URL" | "QUICK_REPLY"; text: string; url?: string }>;
  category: string;
  status: "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "NOT_CREATED" | string;
  enabled: boolean;
  isExternal: boolean;
}

export interface WaNotificationsOverview {
  connection: {
    status: string | null;
    phone_number_id: string | null;
    connected_at: string | null;
    templates_approved: boolean;
    webhook_registered_at: string | null;
  } | null;
  templates: WaTemplateOverview[];
  allApproved: boolean;
  notify_external: { enabled: boolean; phone: string };
}

export function useKapsoNotifications(
  storeId: string | undefined,
  options?: { poll?: boolean },
) {
  return useQuery<WaNotificationsOverview>({
    queryKey: ["kapso-notifications", storeId],
    queryFn: async () => {
      const res = await apiFetch<WaNotificationsOverview>(
        `/api/kapso/notifications/${storeId}`,
      );
      return res.data!;
    },
    enabled: !!storeId,
    // Mientras esperamos la aprobación de Meta conviene refrescar seguido
    refetchInterval: options?.poll ? 30_000 : false,
    staleTime: 30_000,
  });
}

export function useToggleTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      storeId: string;
      templateName: string;
      enabled: boolean;
    }) => {
      const res = await apiFetch(`/api/kapso/notifications/${vars.storeId}/template`, {
        method: "PATCH",
        body: { templateName: vars.templateName, enabled: vars.enabled },
      });
      return res.data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["kapso-notifications", vars.storeId] });
    },
    onError: (error: Error) => {
      toast.error(
        error instanceof ApiError ? error.message : "No se pudo actualizar la notificación",
      );
    },
  });
}

export function useSetExternalNotify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      storeId: string;
      enabled: boolean;
      phone?: string;
    }) => {
      const res = await apiFetch<{ enabled: boolean; phone: string }>(
        `/api/kapso/notifications/${vars.storeId}/external`,
        { method: "PATCH", body: { enabled: vars.enabled, phone: vars.phone } },
      );
      return res.data!;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["kapso-notifications", vars.storeId] });
    },
    onError: (error: Error) => {
      toast.error(
        error instanceof ApiError ? error.message : "No se pudo guardar la configuración",
      );
    },
  });
}

export function useKapsoProvision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { storeId: string }) => {
      const res = await apiFetch<{
        created: string[];
        skipped: string[];
        failed: Array<{ name: string; error: string }>;
        webhookRegistered: boolean;
      }>(`/api/kapso/provision/${vars.storeId}`, { method: "POST" });
      return res.data!;
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["kapso-notifications", vars.storeId] });
      qc.invalidateQueries({ queryKey: ["kapso-status", vars.storeId] });
      if (data.created.length > 0) {
        toast.success(
          `${data.created.length} plantilla(s) enviadas a Meta para aprobación`,
        );
      }
      if (data.failed.length > 0) {
        toast.error(`No se pudieron crear: ${data.failed.map((f) => f.name).join(", ")}`);
      }
    },
    onError: (error: Error) => {
      toast.error(
        error instanceof ApiError ? error.message : "Error aprovisionando plantillas",
      );
    },
  });
}
