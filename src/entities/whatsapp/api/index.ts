import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch, ApiError } from "@/shared/api/client"
import { toast } from "sonner"
import type {
  WhatsAppMetaInfo,
  CheckTemplatesResponse,
  WhatsAppInstanceResponse,
  CreateInstanceRequest,
} from "../model/types"

// === Hooks Meta Cloud API (oficial) ===

export function useWhatsAppStatus(storeId: string | undefined) {
  return useQuery<WhatsAppMetaInfo | null>({
    queryKey: ["whatsapp-status", storeId],
    queryFn: async () => {
      if (!storeId) return null
      const response = await apiFetch<WhatsAppMetaInfo>(`/api/whatsapp-meta/status/${storeId}`)
      return response.data ?? null
    },
    enabled: !!storeId,
  })
}

export function useConnectWhatsAppMeta() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ storeId, accessToken, wabaId, phoneNumberId }: {
      storeId: string; accessToken: string; wabaId?: string; phoneNumberId?: string
    }) => {
      const response = await apiFetch<WhatsAppMetaInfo>("/api/whatsapp-meta/connect", {
        method: "POST",
        body: { storeId, accessToken, wabaId, phoneNumberId },
      })
      return response.data!
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status", variables.storeId] })
    },
    onError: (error: Error) => {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error("Error al conectar WhatsApp")
      }
    },
  })
}

export function useConnectManual() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ storeId, phoneNumberId, wabaId, accessToken }: {
      storeId: string; phoneNumberId: string; wabaId: string; accessToken: string
    }) => {
      const response = await apiFetch<WhatsAppMetaInfo>("/api/whatsapp-meta/connect-manual", {
        method: "POST",
        body: { storeId, phoneNumberId, wabaId, accessToken },
      })
      return response.data!
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status", variables.storeId] })
      toast.success("WhatsApp conectado exitosamente")
    },
    onError: (error: Error) => {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error("Error al conectar WhatsApp")
      }
    },
  })
}

export function useCreateSingleTemplate() {
  return useMutation({
    mutationFn: async ({ storeId, templateName }: { storeId: string; templateName: string }) => {
      const response = await apiFetch<any>("/api/whatsapp-meta/create-template", {
        method: "POST",
        body: { storeId, templateName },
      })
      return response.data
    },
  })
}

export function useCheckTemplates(storeId: string | undefined, enabled = false) {
  return useQuery<CheckTemplatesResponse>({
    queryKey: ["whatsapp-templates", storeId],
    queryFn: async () => {
      const response = await apiFetch<CheckTemplatesResponse>("/api/whatsapp-meta/check-templates", {
        method: "POST",
        body: { storeId },
      })
      return response.data!
    },
    enabled: !!storeId && enabled,
    refetchInterval: enabled ? 30000 : false,
  })
}

export function useDisconnectWhatsApp() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (storeId: string) => {
      await apiFetch(`/api/whatsapp-meta/disconnect/${storeId}`, { method: "DELETE" })
    },
    onSuccess: (_, storeId) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status", storeId] })
      toast.success("WhatsApp desconectado")
    },
    onError: () => {
      toast.error("Error al desconectar")
    },
  })
}

// === Funciones legacy (API no oficial) ===

const API_URL = import.meta.env.VITE_API_URL

export async function createWhatsAppInstance(
  request: CreateInstanceRequest
): Promise<WhatsAppInstanceResponse> {
  const response = await fetch(`${API_URL}/api/whatsapp/instance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`Error al crear instancia de WhatsApp: ${response.statusText}`)
  }

  const result = await response.json()
  return result.data
}

export async function getWhatsAppInstance(userId: string): Promise<WhatsAppInstanceResponse> {
  const response = await fetch(`${API_URL}/api/whatsapp/instance/${userId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Error al obtener instancia de WhatsApp: ${response.statusText}`)
  }

  const result = await response.json()
  return result.data
}
