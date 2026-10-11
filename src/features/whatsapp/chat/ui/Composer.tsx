import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { formatMoney } from "@/shared/lib/money";
import { sonar, useEscaner, useManejadorEscaneo } from "@/features/scanner";

export function Composer({
  disabled,
  sending,
  onSend,
  storeId,
}: {
  disabled?: boolean;
  sending?: boolean;
  onSend: (text: string) => void;
  /** Con la tienda, la pistola escribe el producto escaneado en el mensaje. */
  storeId?: string;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const ajustarAlto = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  };

  const submit = () => {
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value);
    setText("");
    if (ref.current) ref.current.style.height = "auto";
  };

  // ─── Escáner ───────────────────────────────────────────────────────────
  // Con el chat abierto, el producto escaneado se escribe en el mensaje con
  // su precio ("¿tenés Coca?" → se escanea y se manda). Varios escaneos, una
  // línea cada uno. No se envía solo: la persona lo revisa y lo manda.
  // Si el código no está registrado, la hoja de siempre para darlo de alta.
  const { buscar } = useEscaner();
  useManejadorEscaneo(
    async (lectura) => {
      const r = await buscar(lectura.codigo);
      const p = r.producto;
      if (!p) return false;
      const tienda = p.tiendas.find((t) => t.storeId === storeId);
      if (!tienda) {
        sonar("error");
        toast.error(`«${p.name}» no se vende en esta tienda`);
        return true;
      }
      const linea = `${p.name} — ${formatMoney(tienda.price, tienda.currency || "BOB")}`;
      setText((previo) => (previo.trim() ? `${previo.trimEnd()}\n${linea}` : linea));
      sonar("encontrado");
      if (tienda.stock <= 0 && !tienda.sellWithoutStock) {
        toast.warning(`Ojo: no hay stock de «${p.name}»`);
      }
      window.requestAnimationFrame(() => {
        ajustarAlto();
        ref.current?.focus();
      });
      return true;
    },
    Boolean(storeId),
    "Lo escribe en el mensaje con su precio",
  );

  return (
    <div className="flex items-end gap-2 border-t border-border bg-card px-3 py-2.5">
      <textarea
        ref={ref}
        rows={1}
        value={text}
        disabled={disabled}
        placeholder="Escribe un mensaje…"
        onChange={(e) => {
          setText(e.target.value);
          ajustarAlto();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        className="max-h-32 flex-1 resize-none rounded-2xl border border-input bg-background px-4 py-2.5 text-base md:text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
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
