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
