import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/shared/ui/button";

export function Composer({
  disabled,
  sending,
  onSend,
}: {
  disabled?: boolean;
  sending?: boolean;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value);
    setText("");
    if (ref.current) ref.current.style.height = "auto";
  };

  return (
    <div className="flex items-end gap-2 border-t border-border/60 bg-card/60 px-3 py-2.5 backdrop-blur-sm">
      <textarea
        ref={ref}
        rows={1}
        value={text}
        disabled={disabled}
        placeholder="Escribe un mensaje…"
        onChange={(e) => {
          setText(e.target.value);
          const el = e.target;
          el.style.height = "auto";
          el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        className="max-h-32 flex-1 resize-none rounded-2xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      />
      <Button
        size="icon"
        onClick={submit}
        disabled={disabled || sending || !text.trim()}
        className="h-10 w-10 shrink-0 rounded-full text-white"
        style={{ background: "var(--primary-grad)" }}
        aria-label="Enviar"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
