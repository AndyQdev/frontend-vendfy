// Tipos del inbox de WhatsApp (espejo del backend src/inbox).

export type MessagingProviderId = "kapso" | "meta";
export type MessageDirection = "inbound" | "outbound";
export type MessageSenderType = "customer" | "agent_ai" | "agent_human";
export type MessageType = "text" | "image" | "interactive" | "location" | "unknown";
export type MessageStatus = "sent" | "delivered" | "read" | "failed";

/**
 * Conversación de PRUEBA del agente: existe siempre (aunque no haya número
 * conectado) y se ancla arriba de la lista. El teléfono reservado no es un
 * número válido, así que jamás choca con un cliente real.
 */
export const SANDBOX_PHONE = "__sandbox__";
export const SANDBOX_DISPLAY_NAME = "Agente IA — Modo prueba";

export function isSandboxPhone(phone: string | null | undefined): boolean {
  return phone === SANDBOX_PHONE;
}

/** Botones / lista / imagen que el agente adjuntó a un mensaje. */
export interface MessageInteractive {
  type: "button" | "list" | "image";
  buttons?: Array<{ id: string; title: string }>;
  rows?: Array<{ id: string; title: string; description?: string }>;
  buttonLabel?: string;
  imageUrl?: string;
}

export interface Conversation {
  id: string;
  storeId: string;
  contactPhone: string;
  contactName: string | null;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  aiPaused: boolean;
  provider: MessagingProviderId;
  /** El anuncio por el que llegó la última vez (sin el ctwa_clid). */
  anuncio?: AnuncioDeOrigen | null;
}

export interface AnuncioDeOrigen {
  id: string | null;
  titulo: string | null;
  texto: string | null;
  red: "facebook" | "instagram" | "otra";
  imagen: string | null;
  desde: string | null;
  /** Dentro de los 7 días en que la venta todavía se le atribuye. */
  vigente: boolean;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  storeId: string;
  contactPhone: string;
  direction: MessageDirection;
  senderType: MessageSenderType;
  messageType: MessageType;
  content: string | null;
  status: MessageStatus;
  occurredAt: string;
  interactive?: MessageInteractive | null;
}
