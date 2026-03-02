import type { WhatsAppInstanceResponse, CreateInstanceRequest } from "../model/types"

const API_URL = import.meta.env.VITE_API_URL

if (!API_URL) {
  console.warn('VITE_API_URL no está configurada en las variables de entorno')
}

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
