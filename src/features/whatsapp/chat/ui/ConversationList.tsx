import { useMemo, useState } from "react";
import {
  Search,
  Loader2,
  MessageCircle,
  UserRound,
  FlaskConical,
  Megaphone,
} from "lucide-react";
import { Input } from "@/shared/ui/input";
import { ChipAnuncio } from "./AnuncioDeOrigen";
import { cn } from "@/shared/lib/cn";
import {
  isSandboxPhone,
  type Conversation,
} from "@/entities/whatsapp/model/inbox-types";

function initials(c: Conversation) {
  const base = c.contactName?.trim() || c.contactPhone;
  return base.slice(0, 2).toUpperCase();
}

function fmtWhen(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit" });
}

export function ConversationList({
  conversations,
  selectedPhone,
  onSelect,
  loading,
}: {
  conversations: Conversation[];
  selectedPhone: string | null;
  onSelect: (phone: string) => void;
  loading?: boolean;
}) {
  const [q, setQ] = useState("");
  const [soloAnuncios, setSoloAnuncios] = useState(false);
  const conAnuncio = useMemo(() => conversations.filter((c) => c.anuncio).length, [conversations]);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    const base = soloAnuncios ? conversations.filter((c) => c.anuncio) : conversations;
    if (!term) return base;
    return base.filter(
      (c) =>
        c.contactPhone.includes(term) ||
        (c.contactName ?? "").toLowerCase().includes(term),
    );
  }, [conversations, q, soloAnuncios]);

  return (
    <aside className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border/60 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar conversación…"
            className="pl-9"
          />
        </div>
        {conAnuncio > 0 && (
          <button
            type="button"
            onClick={() => setSoloAnuncios((v) => !v)}
            aria-pressed={soloAnuncios}
            className={cn(
              "mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              soloAnuncios
                ? "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
                : "border-border text-muted-foreground hover:bg-accent/60",
            )}
          >
            <Megaphone className="h-3.5 w-3.5" />
            Vinieron de anuncios ({conAnuncio})
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
            <MessageCircle className="h-8 w-8 opacity-50" />
            <p className="text-sm">
              {q ? "Sin resultados" : "Aún no hay conversaciones"}
            </p>
          </div>
        ) : (
          filtered.map((c) => {
            const active = c.contactPhone === selectedPhone;
            const sandbox = isSandboxPhone(c.contactPhone);
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.contactPhone)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors",
                  active
                    ? "bg-primary-soft/60"
                    : sandbox
                      ? "bg-primary-soft/15 hover:bg-primary-soft/35"
                      : "hover:bg-accent/60",
                )}
              >
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    sandbox
                      ? "text-white shadow-md"
                      : "bg-primary-soft text-primary-soft-foreground",
                  )}
                  style={sandbox ? { background: "var(--primary-grad)" } : undefined}
                >
                  {sandbox ? (
                    <FlaskConical className="h-5 w-5" />
                  ) : c.contactName ? (
                    initials(c)
                  ) : (
                    <UserRound className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold">
                      <span className="truncate">
                        {sandbox
                          ? "Agente IA — Modo prueba"
                          : c.contactName || c.contactPhone}
                      </span>
                      {sandbox && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-soft-foreground">
                          Prueba
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {sandbox && !c.lastMessageAt
                        ? "Pruébalo"
                        : fmtWhen(c.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">
                      {c.lastMessageText || "—"}
                    </span>
                    {c.unreadCount > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                  {((c.aiPaused && !sandbox) || c.anuncio) && (
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
                      {c.aiPaused && !sandbox && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          Control humano
                        </span>
                      )}
                      {c.anuncio && <ChipAnuncio anuncio={c.anuncio} className="min-w-0" />}
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
