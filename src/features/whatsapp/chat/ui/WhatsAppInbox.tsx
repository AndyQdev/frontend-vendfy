import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Store } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { useStore } from "@/app/providers/auth";
import {
  useKapsoProvision,
  useKapsoStatus,
} from "@/entities/whatsapp/api/inbox";
import { ChatLayout } from "./ChatLayout";
import {
  WhatsAppConfigModal,
  type ConfigTab,
} from "../../config/ui/WhatsAppConfigModal";

/**
 * Página de WhatsApp: una sola card a pantalla completa con TODO dentro
 * (estado del número, configuración, buscador, conversaciones y chat).
 * El chat siempre está disponible: aunque el número no esté conectado,
 * existe la conversación de prueba del agente.
 */
export function WhatsAppInbox() {
  const { selectedStore } = useStore();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [configOpen, setConfigOpen] = useState(false);
  const [configTab, setConfigTab] = useState<ConfigTab>("connection");
  const provisionedRef = useRef(false);

  const storeId =
    selectedStore && selectedStore !== "all"
      ? (selectedStore as any).id
      : undefined;

  const statusQuery = useKapsoStatus(storeId);
  const provision = useKapsoProvision();

  const openConfig = (tab: ConfigTab) => {
    setConfigTab(tab);
    setConfigOpen(true);
  };

  // Callback del setup de Kapso (?success=true) → refrescar + aprovisionar
  useEffect(() => {
    if (!storeId) return;
    if (params.get("success") === "true") {
      qc.invalidateQueries({ queryKey: ["kapso-status", storeId] });
      toast.success("¡Número de WhatsApp vinculado!", {
        description: "Estamos creando tus plantillas de mensajes automáticos…",
      });
      if (!provisionedRef.current) {
        provisionedRef.current = true;
        // El webhook de Kapso también aprovisiona; esto es un respaldo idempotente
        setTimeout(() => provision.mutate({ storeId }), 4000);
      }
      openConfig("notifications");
      params.delete("success");
      params.delete("store_id");
      setParams(params, { replace: true });
    }
    if (params.get("error") === "connection_failed") {
      toast.error("La conexión con Meta no se completó", {
        description: "Puedes intentarlo de nuevo desde Configurar.",
      });
      params.delete("error");
      params.delete("store_id");
      setParams(params, { replace: true });
    }
    // Enlace directo a la config (ej. desde la página de pedidos)
    const configParam = params.get("config");
    if (configParam === "notifications" || configParam === "connection") {
      openConfig(configParam);
      params.delete("config");
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, storeId]);

  if (!storeId) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Card className="flex max-w-md flex-col items-center gap-3 p-10 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-white"
            style={{ background: "var(--primary-grad)" }}
          >
            <Store className="h-7 w-7" />
          </div>
          <h1 className="font-display text-xl font-bold">Selecciona una tienda</h1>
          <p className="text-sm text-muted-foreground">
            Elige una tienda en el selector para gestionar su WhatsApp.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <>
      <ChatLayout
        storeId={storeId}
        connectionStatus={statusQuery.data?.status ?? null}
        loadingStatus={statusQuery.isLoading}
        onOpenConfig={openConfig}
      />

      <WhatsAppConfigModal
        open={configOpen}
        onOpenChange={setConfigOpen}
        storeId={storeId}
        initialTab={configTab}
      />
    </>
  );
}
