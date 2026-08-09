import {
  Check,
  CheckCheck,
  Bot,
  AlertCircle,
  CornerUpLeft,
  List,
} from "lucide-react";
import type {
  ChatMessage,
  MessageStatus,
} from "@/entities/whatsapp/model/inbox-types";
import { cn } from "@/shared/lib/cn";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-BO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Ticks({ status }: { status: MessageStatus }) {
  if (status === "failed")
    return <AlertCircle className="h-3 w-3 text-red-500" />;
  if (status === "read")
    return <CheckCheck className="h-3 w-3 text-sky-500" />;
  if (status === "delivered")
    return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
  return <Check className="h-3 w-3 text-muted-foreground" />;
}

export function MessageBubble({
  message,
  side,
  isBotReply,
  onInteractiveClick,
}: {
  message: ChatMessage;
  /** Lado del hilo: en el chat de prueba se invierte (ver useChat) */
  side: "mine" | "peer";
  isBotReply?: boolean;
  /** Solo en el chat de prueba: permite tocar los botones del agente */
  onInteractiveClick?: (id: string, title: string) => void;
}) {
  const mine = side === "mine";
  const interactive = message.interactive ?? null;
  const clickable = !!onInteractiveClick;

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-1",
        mine ? "items-end" : "items-start",
      )}
    >
      {/* Burbuja */}
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          mine
            ? "rounded-br-sm bg-primary-soft text-foreground"
            : "rounded-bl-sm bg-card text-foreground ring-1 ring-black/5 dark:ring-white/5",
        )}
      >
        {isBotReply ? (
          <span className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary-soft-foreground">
            <Bot className="h-3 w-3" /> Agente IA
          </span>
        ) : (
          <>
            {!mine && message.senderType === "agent_ai" && (
              <span className="mb-0.5 flex items-center gap-1 text-[10px] font-bold text-primary-soft-foreground">
                <Bot className="h-3 w-3" /> IA
              </span>
            )}
            {message.senderType === "agent_human" && (
              <span className="mb-0.5 block text-[10px] font-bold text-muted-foreground">
                Operador
              </span>
            )}
          </>
        )}

        {interactive?.type === "image" && interactive.imageUrl && (
          <a
            href={interactive.imageUrl}
            target="_blank"
            rel="noreferrer"
            className="mb-1.5 block overflow-hidden rounded-lg"
          >
            <img
              src={interactive.imageUrl}
              alt={message.content ?? ""}
              className="max-h-56 w-full max-w-[16rem] object-contain"
            />
          </a>
        )}

        {message.content && (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        )}

        <span className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
          {fmtTime(message.occurredAt)}
          {mine && !isBotReply && <Ticks status={message.status} />}
        </span>
      </div>

      {/* Botones de respuesta rápida: cards debajo de la burbuja (como WhatsApp) */}
      {interactive?.type === "button" && interactive.buttons?.length ? (
        <div className="flex w-full max-w-[78%] flex-col gap-1">
          {interactive.buttons.map((b) => (
            <button
              key={b.id}
              type="button"
              disabled={!clickable}
              onClick={
                clickable ? () => onInteractiveClick!(b.id, b.title) : undefined
              }
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-2xl bg-card px-4 py-2.5 text-sm font-medium shadow-sm ring-1 ring-black/5 transition-colors dark:ring-white/5",
                clickable
                  ? "cursor-pointer text-primary-soft-foreground hover:bg-accent active:bg-accent/80"
                  : "cursor-default text-primary-soft-foreground/80",
              )}
            >
              <CornerUpLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
              {b.title}
            </button>
          ))}
        </div>
      ) : null}

      {/* Lista interactiva: card con las filas (como el selector de WhatsApp) */}
      {interactive?.type === "list" && interactive.rows?.length ? (
        <div className="w-full max-w-[78%] overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/5">
          <p className="flex items-center gap-1.5 border-b border-border/60 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-primary-soft-foreground">
            <List className="h-3.5 w-3.5" />
            {interactive.buttonLabel || "Ver opciones"}
          </p>
          {interactive.rows.map((r) => (
            <button
              key={r.id}
              type="button"
              disabled={!clickable}
              onClick={
                clickable ? () => onInteractiveClick!(r.id, r.title) : undefined
              }
              className={cn(
                "flex w-full flex-col items-start border-b border-border/40 px-4 py-2.5 text-left transition-colors last:border-b-0",
                clickable
                  ? "cursor-pointer hover:bg-accent active:bg-accent/80"
                  : "cursor-default",
              )}
            >
              <span className="text-sm">{r.title}</span>
              {r.description && (
                <span className="mt-0.5 text-xs text-muted-foreground">
                  {r.description}
                </span>
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Burbuja "escribiendo…" del agente mientras procesa */
export function TypingBubble() {
  return (
    <div className="flex w-full justify-start">
      <div className="rounded-2xl rounded-bl-sm bg-card px-3.5 py-3 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
        <div className="flex items-center gap-1">
          {[0, 200, 400].map((delay) => (
            <span
              key={delay}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"
              style={{ animationDelay: `${delay}ms`, animationDuration: "1000ms" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
