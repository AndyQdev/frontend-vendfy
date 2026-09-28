import { useNavigate } from "react-router-dom";
import { AlertTriangle, Bot, CheckCircle2, ClipboardList, Package } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn";
import type { DashboardData } from "../model/use-dashboard-data";

interface AttentionItem {
  id: string;
  icon: LucideIcon;
  message: string;
  actionLabel: string;
  to: string;
  tone: "warning" | "danger" | "info";
}

const TONES: Record<AttentionItem["tone"], string> = {
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
  danger: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
};

export function AttentionPanel({
  data,
  className,
}: {
  data: DashboardData;
  className?: string;
}) {
  const navigate = useNavigate();
  const items: AttentionItem[] = [];

  const toConfirm = data.statuses.find((status) => status.key === "to-confirm")?.count ?? 0;
  const pending = data.statuses.find((status) => status.key === "pending")?.count ?? 0;

  if (toConfirm > 0) {
    items.push({
      id: "to-confirm",
      icon: ClipboardList,
      message: `${toConfirm} ${toConfirm === 1 ? "pedido espera" : "pedidos esperan"} confirmación`,
      actionLabel: "Revisar",
      to: "/orders",
      tone: "warning",
    });
  }

  if (pending > 0) {
    items.push({
      id: "pending",
      icon: ClipboardList,
      message: `${pending} ${pending === 1 ? "pedido pendiente" : "pedidos pendientes"} de atender`,
      actionLabel: "Abrir pedidos",
      to: "/orders",
      tone: "info",
    });
  }

  if (data.lowStock.length > 0) {
    items.push({
      id: "low-stock",
      icon: Package,
      message: `${data.lowStock.length} ${
        data.lowStock.length === 1 ? "producto está" : "productos están"
      } por agotarse`,
      actionLabel: "Ver inventario",
      to: "/inventory",
      tone: "danger",
    });
  }

  if (data.isWhatsAppConnected === false) {
    items.push({
      id: "whatsapp",
      icon: Bot,
      message: "WhatsApp está desconectado",
      actionLabel: "Conectar",
      to: "/whatsapp",
      tone: "warning",
    });
  }

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          Necesita tu atención
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Todo está al día. No hay pendientes urgentes.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className={`rounded-lg p-2 ${TONES[item.tone]}`}>
                  <item.icon className="h-4 w-4" />
                </span>
                <p className="min-w-0 text-sm font-medium">{item.message}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate(item.to)}>
                {item.actionLabel}
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
