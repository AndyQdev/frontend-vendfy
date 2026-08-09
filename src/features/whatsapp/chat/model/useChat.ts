import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getChatSocket } from "@/entities/whatsapp/api/chat-socket";
import {
  useConversations,
  useMessages,
  useSendInboxMessage,
  useTakeover,
  useRelease,
  useMarkRead,
  useSandboxSend,
  useClearSandbox,
} from "@/entities/whatsapp/api/inbox";
import {
  SANDBOX_DISPLAY_NAME,
  SANDBOX_PHONE,
  isSandboxPhone,
  type ChatMessage,
  type Conversation,
} from "@/entities/whatsapp/model/inbox-types";

const convKey = (storeId: string) => ["inbox-conversations", storeId];
const msgKey = (storeId: string, phone: string) => [
  "inbox-messages",
  storeId,
  phone,
];

/**
 * Orquesta el chat: carga inicial (React Query) + tiempo real (Socket.IO).
 * Incluye la conversación de PRUEBA del agente, que existe siempre y va
 * anclada arriba: permite probar el bot sin número de WhatsApp conectado.
 */
export function useChat(storeId?: string) {
  const qc = useQueryClient();
  const conversationsQuery = useConversations(storeId);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const messagesQuery = useMessages(storeId, selectedPhone ?? undefined);

  const sendMut = useSendInboxMessage();
  const sandboxMut = useSandboxSend();
  const clearSandboxMut = useClearSandbox();
  const takeoverMut = useTakeover();
  const releaseMut = useRelease();
  const markReadMut = useMarkRead();

  const [botTyping, setBotTyping] = useState(false);
  const autoSelected = useRef(false);

  // ---- Socket: join + suscripción ----
  useEffect(() => {
    if (!storeId) return;
    const socket = getChatSocket();
    const token = localStorage.getItem("authToken") || "";
    const join = () => socket.emit("join", { storeId, token });

    const onMessage = (msg: ChatMessage) => {
      if (msg.storeId !== storeId) return;
      qc.setQueryData<ChatMessage[]>(msgKey(storeId, msg.contactPhone), (prev) => {
        const list = prev ?? [];
        if (list.some((m) => m.id === msg.id)) return list;
        // Al llegar el real, se descarta el optimista equivalente
        const withoutTemp = list.filter(
          (m) => !(m.id.startsWith("tmp-") && m.content === msg.content),
        );
        return [...withoutTemp, msg];
      });
      qc.invalidateQueries({ queryKey: convKey(storeId) });
    };

    const onConversation = (conv: Conversation) => {
      if (conv.storeId !== storeId) return;
      qc.setQueryData<Conversation[]>(convKey(storeId), (prev) => {
        const list = prev ?? [];
        const idx = list.findIndex((c) => c.id === conv.id);
        const next = idx === -1 ? [conv, ...list] : list.map((c) => (c.id === conv.id ? conv : c));
        return [...next].sort((a, b) =>
          (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""),
        );
      });
    };

    socket.on("connect", join);
    socket.on("whatsapp:message", onMessage);
    socket.on("whatsapp:conversation", onConversation);
    if (socket.connected) join();

    return () => {
      socket.off("connect", join);
      socket.off("whatsapp:message", onMessage);
      socket.off("whatsapp:conversation", onConversation);
    };
  }, [storeId, qc]);

  /**
   * Lista de conversaciones con el chat de prueba SIEMPRE presente y anclado
   * arriba (aunque nunca se haya escrito en él).
   */
  const conversations = useMemo<Conversation[]>(() => {
    const real = conversationsQuery.data ?? [];
    const list = [...real];
    if (!list.some((c) => isSandboxPhone(c.contactPhone))) {
      list.push({
        id: "sandbox-placeholder",
        storeId: storeId ?? "",
        contactPhone: SANDBOX_PHONE,
        contactName: SANDBOX_DISPLAY_NAME,
        lastMessageText: "Escribe aquí para probar tu agente",
        lastMessageAt: null,
        unreadCount: 0,
        aiPaused: false,
        provider: "kapso",
      });
    }
    return list.sort((a, b) => {
      if (isSandboxPhone(a.contactPhone)) return -1;
      if (isSandboxPhone(b.contactPhone)) return 1;
      return (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? "");
    });
  }, [conversationsQuery.data, storeId]);

  // En desktop abrimos el chat de prueba por defecto: siempre hay algo con
  // qué jugar aunque la tienda no tenga WhatsApp conectado ni clientes.
  useEffect(() => {
    if (autoSelected.current || !storeId || selectedPhone) return;
    if (typeof window !== "undefined" && window.innerWidth < 1024) return;
    autoSelected.current = true;
    setSelectedPhone(SANDBOX_PHONE);
  }, [storeId, selectedPhone]);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.contactPhone === selectedPhone) ?? null,
    [conversations, selectedPhone],
  );
  const isSandbox = isSandboxPhone(selectedPhone);

  // Marcar leído al abrir una conversación real con no-leídos.
  useEffect(() => {
    if (
      storeId &&
      selectedConversation &&
      !isSandboxPhone(selectedConversation.contactPhone) &&
      selectedConversation.unreadCount > 0
    ) {
      markReadMut.mutate({
        storeId,
        conversationId: selectedConversation.id,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPhone, selectedConversation?.id]);

  /** Inserta un mensaje optimista y devuelve su id temporal */
  const pushOptimistic = (phone: string, content: string, mine: boolean) => {
    if (!storeId) return null;
    const tempId = `tmp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      conversationId: selectedConversation?.id ?? "",
      storeId,
      contactPhone: phone,
      // En el sandbox el operador juega al CLIENTE → sus mensajes son entrantes
      direction: mine && !isSandboxPhone(phone) ? "outbound" : "inbound",
      senderType: isSandboxPhone(phone) ? "customer" : "agent_human",
      messageType: "text",
      content,
      status: "sent",
      occurredAt: new Date().toISOString(),
    };
    qc.setQueryData<ChatMessage[]>(msgKey(storeId, phone), (prev) => [
      ...(prev ?? []),
      optimistic,
    ]);
    return tempId;
  };

  const dropOptimistic = (phone: string, tempId: string | null) => {
    if (!storeId || !tempId) return;
    qc.setQueryData<ChatMessage[]>(msgKey(storeId, phone), (prev) =>
      (prev ?? []).filter((m) => m.id !== tempId),
    );
  };

  const send = async (content: string) => {
    if (!storeId || !selectedPhone || !content.trim()) return;
    const phone = selectedPhone;
    const tempId = pushOptimistic(phone, content, true);

    // ---- Chat de prueba: habla con el agente, no con WhatsApp ----
    if (isSandboxPhone(phone)) {
      setBotTyping(true);
      try {
        await sandboxMut.mutateAsync({ storeId, text: content });
      } catch {
        dropOptimistic(phone, tempId);
      } finally {
        setBotTyping(false);
        qc.invalidateQueries({ queryKey: msgKey(storeId, phone) });
        qc.invalidateQueries({ queryKey: convKey(storeId) });
      }
      return;
    }

    // ---- Chat real: mensaje del operador por WhatsApp ----
    try {
      const real = await sendMut.mutateAsync({
        storeId,
        contactPhone: phone,
        content,
      });
      qc.setQueryData<ChatMessage[]>(msgKey(storeId, phone), (prev) => {
        const replaced = (prev ?? []).map((m) => (m.id === tempId ? real : m));
        return replaced.filter(
          (m, i, arr) => arr.findIndex((x) => x.id === m.id) === i,
        );
      });
      qc.invalidateQueries({ queryKey: convKey(storeId) });
    } catch {
      dropOptimistic(phone, tempId);
    }
  };

  /** Tap de un botón del agente (solo en el chat de prueba) */
  const sendInteractive = async (buttonId: string, title: string) => {
    if (!storeId || !isSandbox) return;
    const tempId = pushOptimistic(SANDBOX_PHONE, title, true);
    setBotTyping(true);
    try {
      await sandboxMut.mutateAsync({ storeId, buttonId, buttonTitle: title });
    } catch {
      dropOptimistic(SANDBOX_PHONE, tempId);
    } finally {
      setBotTyping(false);
      qc.invalidateQueries({ queryKey: msgKey(storeId, SANDBOX_PHONE) });
      qc.invalidateQueries({ queryKey: convKey(storeId) });
    }
  };

  const clearSandbox = async () => {
    if (!storeId) return;
    await clearSandboxMut.mutateAsync({ storeId });
    qc.setQueryData<ChatMessage[]>(msgKey(storeId, SANDBOX_PHONE), []);
    qc.invalidateQueries({ queryKey: convKey(storeId) });
  };

  const toggleAi = async (paused: boolean) => {
    if (!storeId || !selectedConversation || isSandbox) return;
    const vars = { storeId, conversationId: selectedConversation.id };
    if (paused) await takeoverMut.mutateAsync(vars);
    else await releaseMut.mutateAsync(vars);
    qc.invalidateQueries({ queryKey: convKey(storeId) });
  };

  return {
    conversations,
    loadingConversations: conversationsQuery.isLoading,
    messages: messagesQuery.data ?? [],
    loadingMessages: messagesQuery.isLoading,
    selectedPhone,
    setSelectedPhone,
    selectedConversation,
    isSandbox,
    botTyping,
    send,
    sendInteractive,
    sending: sendMut.isPending || sandboxMut.isPending,
    clearSandbox,
    clearing: clearSandboxMut.isPending,
    toggleAi,
    togglingAi: takeoverMut.isPending || releaseMut.isPending,
  };
}
