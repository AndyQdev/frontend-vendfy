import { io, type Socket } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

let socket: Socket | null = null;

/**
 * Singleton del socket del inbox de WhatsApp (namespace /whatsapp).
 * Se reusa entre montajes para no abrir múltiples conexiones.
 */
export function getChatSocket(): Socket {
  if (!socket) {
    socket = io(`${API_URL}/whatsapp`, {
      transports: ["websocket"],
      autoConnect: true,
    });
  }
  return socket;
}
