import {
  Loader2,
  MessageCircle,
  MessageSquare,
  Settings,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn";
import { isSandboxPhone } from "@/entities/whatsapp/model/inbox-types";
import { useChat } from "../model/useChat";
import { ConversationList } from "./ConversationList";
import { ChatView } from "./ChatView";
import type { ConfigTab } from "../../config/ui/WhatsAppConfigModal";
import { useAcceso } from "@/app/providers/acceso";
import { PERMISO } from "@/shared/acceso/permisos";

/**
 * Card única a pantalla completa: cabecera con el estado del número y el
 * acceso a configuración, lista de conversaciones (con el chat de prueba
 * siempre arriba) y el hilo. 2 columnas en desktop, una sola en móvil.
 */
export function ChatLayout({
  storeId,
  connectionStatus,
  loadingStatus,
  onOpenConfig,
}: {
  storeId: string;
  connectionStatus: string | null;
  loadingStatus?: boolean;
  onOpenConfig: (tab: ConfigTab) => void;
}) {
  const puedeConfigurar = useAcceso().puede(PERMISO.GESTIONAR_TIENDAS);
  const chat = useChat(storeId);
  const { selectedConversation, selectedPhone } = chat;
  const isSandbox = isSandboxPhone(selectedPhone);

  const connected = connectionStatus === "connected";
  const pending = connectionStatus === "pending";

  return (
    <Card className="grid h-[calc(100dvh-var(--alto-header)-2.25rem)] min-h-[30rem] grid-cols-1 overflow-hidden p-0 lg:grid-cols-[23rem_1fr]">
      {/* Columna izquierda: cabecera + aviso + conversaciones */}
      <div
        className={cn(
          "flex min-h-0 flex-col border-r border-border bg-card",
          selectedPhone ? "hidden lg:flex" : "flex",
        )}
      >
        {/* Cabecera de la sección */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border/60 px-4 py-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: "var(--primary-grad)" }}
          >
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-bold leading-tight">
              WhatsApp Business
            </p>
            {loadingStatus ? (
              <span className="text-xs text-muted-foreground">Cargando…</span>
            ) : (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-medium",
                  connected
                    ? "text-emerald-600 dark:text-emerald-400"
                    : pending
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground",
                )}
              >
                {connected ? (
                  <>
                    <Wifi className="h-3 w-3" /> Conectado
                  </>
                ) : pending ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> Vinculando número…
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3" /> Sin conectar
                  </>
                )}
              </span>
            )}
          </div>
          {/* Conectar el número, el agente y los avisos: es configurar la tienda. */}
          {puedeConfigurar ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenConfig(connected ? "notifications" : "connection")}
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Configurar</span>
            </Button>
          ) : null}
        </div>

        {/* Aviso no bloqueante: el chat de prueba funciona igual */}
        {!connected && !loadingStatus && (
          <button
            type="button"
            onClick={() => onOpenConfig("connection")}
            className="shrink-0 border-b border-border/60 bg-primary-soft/30 px-4 py-2 text-left text-xs text-primary-soft-foreground transition-colors hover:bg-primary-soft/50"
          >
            {pending
              ? "Estamos vinculando tu número. Mientras tanto, prueba tu agente aquí abajo. "
              : "Aún no conectas tu número: los chats reales aparecerán aquí. Mientras tanto, prueba tu agente. "}
            <span className="font-semibold underline underline-offset-2">
              {pending ? "Ver progreso" : "Conectar ahora"}
            </span>
          </button>
        )}

        <ConversationList
          conversations={chat.conversations}
          selectedPhone={selectedPhone}
          onSelect={chat.setSelectedPhone}
          loading={chat.loadingConversations}
        />
      </div>

      {/* Columna derecha: hilo */}
      <div className={cn("min-h-0", selectedPhone ? "block" : "hidden lg:block")}>
        {selectedConversation ? (
          <ChatView
            storeId={storeId}
            conversation={selectedConversation}
            messages={chat.messages}
            loading={chat.loadingMessages}
            sending={chat.sending}
            togglingAi={chat.togglingAi}
            botTyping={chat.botTyping}
            clearing={chat.clearing}
            onSend={chat.send}
            onToggleAi={chat.toggleAi}
            onInteractiveClick={isSandbox ? chat.sendInteractive : undefined}
            onClear={isSandbox ? chat.clearSandbox : undefined}
            onBack={() => chat.setSelectedPhone(null)}
            onConfigureAgent={isSandbox ? () => onOpenConfig("agent") : undefined}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-white"
              style={{ background: "var(--primary-grad)" }}
            >
              <MessageSquare className="h-7 w-7" />
            </div>
            <div>
              <p className="font-display text-lg font-bold text-foreground">
                Bandeja de WhatsApp
              </p>
              <p className="text-sm">Elige una conversación para empezar</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
