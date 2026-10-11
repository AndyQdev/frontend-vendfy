import { createContext, useContext } from "react";

/**
 * "Crear «mouse»" desde cualquier tarjeta del chat (el buscador de productos,
 * "No está en tu catálogo"): abre el formulario de producto nuevo EN el chat
 * (G7a). Antes era un enlace a la pantalla de Productos; el asistente no
 * manda a ningún lado. Lo provee la página del asistente.
 */
export const CrearEnChatContext = createContext<((nombre: string) => void) | null>(null);

export const useCrearEnChat = () => useContext(CrearEnChatContext);
