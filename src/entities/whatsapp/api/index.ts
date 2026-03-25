import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch, ApiError } from "@/shared/api/client"
import { toast } from "sonner"
import type {
  WhatsAppKapsoInfo,
  CheckTemplatesResponse,
  CreateConnectionResponse,
  WhatsAppInstanceResponse,
  CreateInstanceRequest,
} from "../model/types"

// === Hooks Kapso (API oficial) ===

export function useWhatsAppStatus(storeId: string | undefined) {
  return useQuery<WhatsAppKapsoInfo | null>({
    queryKey: ["whatsapp-status", storeId],
    queryFn: async () => {
      if (!storeId) return null
      const response = await apiFetch<WhatsAppKapsoInfo>(`/api/kapso/status/${storeId}`)
      return response.data ?? null
    },
    enabled: !!storeId,
  })
}

export function useCreateWhatsAppConnection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ storeId, businessName }: { storeId: string; businessName?: string }) => {
      const response = await apiFetch<CreateConnectionResponse>("/api/kapso/connect", {
        method: "POST",
        body: { storeId, businessName },
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
        toast.error("Error al crear la conexión WhatsApp")
      }
    },
  })
}

export function useGenerateSetupLink() {
  return useMutation({
    mutationFn: async (storeId: string) => {
      const response = await apiFetch<{ setupUrl: string }>("/api/kapso/setup-link", {
        method: "POST",
        body: { storeId },
      })
      return response.data!
    },
    onError: (error: Error) => {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error("Error al generar el enlace de configuración")
      }
    },
  })
}

export function useCheckTemplates(storeId: string | undefined, enabled = false) {
  return useQuery<CheckTemplatesResponse>({
    queryKey: ["whatsapp-templates", storeId],
    queryFn: async () => {
      const response = await apiFetch<CheckTemplatesResponse>("/api/kapso/check-templates", {
        method: "POST",
        body: { storeId },
      })
      return response.data!
    },
    enabled: !!storeId && enabled,
    refetchInterval: enabled ? 30000 : false, // Auto-refetch cada 30s cuando está habilitado
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
