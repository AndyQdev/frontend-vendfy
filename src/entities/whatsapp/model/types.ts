// === Tipos legacy (API no oficial) ===
export interface WhatsAppSession {
  success: boolean
  isAuthenticated: boolean
}

export interface WhatsAppInstanceResponse {
  success: boolean
  message?: string
  qrImage?: string
  data: WhatsAppSession
}

export interface CreateInstanceRequest {
  userId: string
}

// === Tipos Kapso (API oficial) ===
export type WhatsAppKapsoStatus = 'pending' | 'connected' | 'disconnected'

export interface WhatsAppKapsoInfo {
  customer_id?: string
  phone_number_id?: string
  status?: WhatsAppKapsoStatus
  templates_approved?: boolean
  connected_at?: string
}

export interface WhatsAppTemplate {
  name: string
  label: string
  status: 'APPROVED' | 'PENDING' | 'REJECTED'
  category: string
  id: string
}

export interface CheckTemplatesResponse {
  templates: WhatsAppTemplate[]
  allApproved: boolean
  businessAccountId: string
}

export interface CreateConnectionResponse {
  setupUrl: string
  customer_id: string
}

export const WA_REQUIRED_TEMPLATES = [
  'pedido_pendiente_v1',
  'pedido_en_proceso_v1',
  'pedido_en_camino_v1',
  'pedido_completado_v1',
  'pedido_cancelado_v1',
]

export const WA_TEMPLATE_LABELS: Record<string, string> = {
  pedido_pendiente_v1: 'Pedido recibido',
  pedido_en_proceso_v1: 'Pedido en proceso',
  pedido_en_camino_v1: 'Pedido en camino',
  pedido_completado_v1: 'Pedido completado',
  pedido_cancelado_v1: 'Pedido cancelado',
}
