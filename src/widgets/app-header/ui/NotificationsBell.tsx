import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ChevronRight, ClipboardList, ListChecks, type LucideIcon } from "lucide-react";
import { IconBrandWhatsapp } from "@tabler/icons-react";

import { useStore } from "@/app/providers/auth";
import { usePendingOrdersCount } from "@/entities/order/api";
import { useWhatsAppStatus } from "@/entities/whatsapp/api";
import { useOnboardingProgress, useOnboardingVisibility } from "@/widgets/onboarding";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/lib/cn";

/**
 * LA CAMPANA — lo que está esperando al comerciante.
 *
 * Junta en un lugar lo que antes eran tres botones sueltos en la barra
 * ("Primeros pasos 5/6", "Conectar bot", y nada para los pedidos):
 *
 *   · pedidos por atender (el mismo número que la ruta Pedidos),
 *   · pasos que faltan de la guía de primeros pasos — que ahora se abre desde
 *     acá,
 *   · el bot de WhatsApp sin conectar.
 *
 * Todo sale de datos reales. El punto rojo aparece solo si hay algo.
 */
export function NotificationsBell({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { selectedStore } = useStore();
  const storeId = selectedStore && selectedStore !== "all" ? selectedStore.id : undefined;

  const { data: pendingOrders = 0 } = usePendingOrdersCount(storeId);
  const { data: whatsapp, isSuccess: whatsappKnown } = useWhatsAppStatus(storeId);
  const onboarding = useOnboardingProgress();
  const guide = useOnboardingVisibility();

  const items: Aviso[] = [];
  if (pendingOrders > 0) {
    items.push({
      icon: ClipboardList,
      title: pendingOrders === 1 ? "1 pedido por atender" : `${pendingOrders} pedidos por atender`,
      detail: "Pendientes o por confirmar",
      tone: "danger",
      onClick: () => navigate("/orders"),
    });
  }
  if (!onboarding.finished) {
    items.push({
      icon: ListChecks,
      title: `Primeros pasos · ${onboarding.done} de ${onboarding.total}`,
      detail:
        onboarding.remaining === 1 ? "Te falta un paso" : `Te faltan ${onboarding.remaining} pasos`,
      tone: "info",
      onClick: guide.abrir,
    });
  }
  if (storeId && whatsappKnown && whatsapp?.status !== "connected") {
    items.push({
      icon: IconBrandWhatsapp,
      title: "Conecta el bot de WhatsApp",
      detail: "Atiende y vende por ti",
      tone: "info",
      onClick: () => navigate("/marketing?config=connection"),
    });
  }

  const hayAlgo = items.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={hayAlgo ? `Avisos: ${items.length}` : "Avisos"}
        className={cn(
          "relative grid size-10 flex-none place-items-center rounded-full text-foreground transition-colors lg:size-9 lg:bg-muted",
          "hover:bg-muted lg:hover:bg-tinta lg:hover:text-tinta-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "data-[state=open]:bg-tinta data-[state=open]:text-tinta-foreground",
          className
        )}
      >
        <Bell className="size-[18px] lg:size-4" />
        {hayAlgo ? (
          <span className="absolute right-2 top-2 size-2 rounded-full border-[1.5px] border-card bg-destructive lg:right-1.5 lg:top-1.5" />
        ) : null}
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={10} className="w-80 max-w-[calc(100vw-1.5rem)] p-1.5">
        <p className="px-2.5 pb-1.5 pt-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Avisos
        </p>
        {hayAlgo ? (
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => (
              <li key={item.title}>
                <AvisoFila
                  {...item}
                  onClick={() => {
                    setOpen(false);
                    item.onClick();
                  }}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-2.5 pb-3 pt-1 text-[13px] text-muted-foreground">Todo al día. No hay nada esperándote.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface Aviso {
  icon: LucideIcon | typeof IconBrandWhatsapp;
  title: string;
  detail: string;
  tone: "danger" | "info";
  onClick: () => void;
}

function AvisoFila({ icon: Icon, title, detail, tone, onClick }: Aviso) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
    >
      <span
        className={cn(
          "grid size-9 flex-none place-items-center rounded-full",
          tone === "danger" ? "bg-destructive-soft text-destructive-soft-foreground" : "bg-primary-soft text-primary-soft-foreground"
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-[13px] font-semibold text-foreground">{title}</span>
        <span className="truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      <ChevronRight className="size-4 flex-none text-muted-foreground" />
    </button>
  );
}
