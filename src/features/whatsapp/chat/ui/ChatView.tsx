import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  FlaskConical,
  Hand,
  Loader2,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { cn } from "@/shared/lib/cn";
import {
  isSandboxPhone,
  type ChatMessage,
  type Conversation,
} from "@/entities/whatsapp/model/inbox-types";
import { MessageBubble, TypingBubble } from "./MessageBubble";
import { ModelPicker } from "./ModelPicker";
import { Composer } from "./Composer";

export function ChatView({
  storeId,
  conversation,
  messages,
  loading,
  sending,
  togglingAi,
  botTyping,
  clearing,
  onSend,
  onToggleAi,
  onInteractiveClick,
  onClear,
  onBack,
  onConfigureAgent,
}: {
  storeId?: string;
  conversation: Conversation;
  messages: ChatMessage[];
  loading?: boolean;
  sending?: boolean;
  togglingAi?: boolean;
  botTyping?: boolean;
  clearing?: boolean;
  onSend: (text: string) => void;
  onToggleAi: (paused: boolean) => void;
  onInteractiveClick?: (id: string, title: string) => void;
  onClear?: () => void;
  onBack?: () => void;
  onConfigureAgent?: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const isSandbox = isSandboxPhone(conversation.contactPhone);
  const humanControl = conversation.aiPaused;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, conversation.id, botTyping]);

  /**
   * En el chat de prueba el operador juega al CLIENTE: lo que él escribe
   * (inbound) va a la derecha y la respuesta del agente (outbound) a la
   * izquierda — al revés que en un chat real.
   */
  const sideOf = (m: ChatMessage): "mine" | "peer" => {
    if (isSandbox) return m.direction === "inbound" ? "mine" : "peer";
    return m.direction === "outbound" ? "mine" : "peer";
  };

  return (
    <section className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border/60 bg-card/60 px-4 py-3 backdrop-blur-sm">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 lg:hidden"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold",
            isSandbox
              ? "text-white shadow-md"
              : "bg-primary-soft text-primary-soft-foreground",
          )}
          style={isSandbox ? { background: "var(--primary-grad)" } : undefined}
        >
          {isSandbox ? (
            <FlaskConical className="h-5 w-5" />
          ) : conversation.contactName ? (
            conversation.contactName.slice(0, 2).toUpperCase()
          ) : (
            <UserRound className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {isSandbox
              ? "Agente IA — Modo prueba"
              : conversation.contactName || conversation.contactPhone}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {isSandbox ? (
              <>
                <FlaskConical className="h-3 w-3 text-primary-soft-foreground" />
                No se envía nada a WhatsApp real
              </>
            ) : (
              <>
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    humanControl ? "bg-amber-500" : "bg-emerald-500",
                  )}
                />
                {humanControl ? "Control humano" : "Respondido por IA"}
              </>
            )}
          </p>
        </div>

        {isSandbox && storeId && <ModelPicker storeId={storeId} />}

        {onClear && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            title="Vaciar conversación"
            onClick={() => setConfirmClear(true)}
            disabled={clearing}
          >
            {clearing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        )}

        {!isSandbox && (
          <Button
            variant={humanControl ? "outline" : "default"}
            size="sm"
            disabled={togglingAi}
            onClick={() => onToggleAi(!humanControl)}
            className={cn(!humanControl && "text-white")}
            style={!humanControl ? { background: "var(--primary-grad)" } : undefined}
          >
            {togglingAi ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : humanControl ? (
              <>
                <Bot className="mr-1.5 h-4 w-4" /> Devolver a IA
              </>
            ) : (
              <>
                <Hand className="mr-1.5 h-4 w-4" /> Tomar control
              </>
            )}
          </Button>
        )}
      </header>

      {/* Aviso del modo prueba */}
      {isSandbox && (
        <div className="flex shrink-0 items-start gap-2 border-b border-border/60 bg-primary-soft/30 px-4 py-2.5 text-xs text-primary-soft-foreground">
          <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p className="leading-snug">
            <span className="font-semibold">Chatea como si fueras un cliente.</span>{" "}
            Responde el mismo agente que atiende WhatsApp, con tu catálogo real —
            pero nada sale al exterior y los pedidos no se registran.
            {onConfigureAgent && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={onConfigureAgent}
                  className="font-semibold underline underline-offset-2"
                >
                  Configurar el agente
                </button>
              </>
            )}
          </p>
        </div>
      )}

      {/* Hilo de mensajes */}
      <div className="chat-doodle-bg chat-thread-inset min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {loading && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : messages.length === 0 && !botTyping ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center text-sm text-muted-foreground">
            {isSandbox ? (
              <>
                <FlaskConical className="h-8 w-8 text-primary-soft-foreground/70" />
                <p className="font-medium text-foreground">Prueba tu agente</p>
                <p>
                  Escribe algo como “hola, ¿qué tienen?” y mira cómo responde con
                  tus productos.
                </p>
              </>
            ) : (
              <p>No hay mensajes todavía.</p>
            )}
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-2">
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                side={sideOf(m)}
                isBotReply={isSandbox && m.direction === "outbound"}
                onInteractiveClick={
                  isSandbox && m.direction === "outbound"
                    ? onInteractiveClick
                    : undefined
                }
              />
            ))}
            {botTyping && <TypingBubble />}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <Composer disabled={loading} sending={sending} onSend={onSend} />

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vaciar conversación</AlertDialogTitle>
            <AlertDialogDescription>
              {isSandbox
                ? "Se borra el historial de la conversación de prueba y el carrito del agente, para empezar de cero. No afecta a tus chats reales."
                : "Se borrarán todos los mensajes de esta conversación. Esta acción no se puede deshacer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onClear?.();
                setConfirmClear(false);
              }}
            >
              Vaciar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
