import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";
import { SANDBOX_PHONE } from "@/entities/whatsapp/model/inbox-types";
import { useChat } from "@/features/whatsapp/chat/model/useChat";
import { ChatView } from "@/features/whatsapp/chat/ui/ChatView";

/** El chat de prueba: hablas con el agente como si fueras un cliente, sin que salga nada a WhatsApp. */
export function ProbarAgente({
  storeId,
  open,
  onOpenChange,
  onConfigurarAgente,
}: {
  storeId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfigurarAgente: () => void;
}) {
  const chat = useChat(open ? storeId : undefined);
  useEffect(() => {
    if (open && chat.selectedPhone !== SANDBOX_PHONE) chat.setSelectedPhone(SANDBOX_PHONE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chat.selectedPhone]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85dvh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Probar el agente</DialogTitle>
        <DialogDescription className="sr-only">Chatea con el agente como si fueras un cliente.</DialogDescription>
        {chat.selectedConversation ? (
          <ChatView
            storeId={storeId}
            conversation={chat.selectedConversation}
            messages={chat.messages}
            loading={chat.loadingMessages}
            sending={chat.sending}
            togglingAi={chat.togglingAi}
            botTyping={chat.botTyping}
            clearing={chat.clearing}
            onSend={chat.send}
            onToggleAi={chat.toggleAi}
            onInteractiveClick={chat.sendInteractive}
            onClear={chat.clearSandbox}
            onConfigureAgent={onConfigurarAgente}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Preparando el chat de prueba…
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
