import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { Plug, Store as StoreIcon } from "lucide-react";
import { useStore } from "@/app/providers/auth";
import { useIntegrations } from "@/entities/integration/api";
import type { IntegrationProvider } from "@/entities/integration/model/types";
import { IntegrationCard } from "@/features/integrations/ui/IntegrationCard";

const PROVIDERS: IntegrationProvider[] = ["meta", "tiktok", "google"];

/**
 * Growth Hub — conexiones con plataformas de publicidad.
 *
 * Las integraciones pertenecen a una tienda, nunca a la cuenta: por eso
 * exige una tienda seleccionada y no funciona con el modo "todas".
 */
export default function IntegrationsPage() {
  const { selectedStore } = useStore();
  const storeId =
    selectedStore && selectedStore !== "all" ? selectedStore.id : undefined;

  const { data: conexiones = [], isLoading } = useIntegrations(storeId);
  const [params, setParams] = useSearchParams();

  // El backend redirige acá desde el callback de OAuth con el resultado.
  useEffect(() => {
    const resultado = params.get("meta");
    if (!resultado) return;

    if (resultado === "ok") {
      toast.success("Meta conectado correctamente");
    } else {
      toast.error("No se pudo conectar Meta", {
        description: params.get("detalle") ?? undefined,
      });
    }
    params.delete("meta");
    params.delete("detalle");
    setParams(params, { replace: true });
  }, [params, setParams]);

  if (!storeId) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Card className="flex max-w-md flex-col items-center gap-4 p-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <StoreIcon className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold">Elegí una tienda</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Cada tienda conecta sus propias cuentas de publicidad. Seleccioná
              una en la barra superior para configurar sus integraciones.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
          style={{ background: "var(--primary-grad)" }}
        >
          <Plug className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Integraciones</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Conectá las plataformas donde hacés publicidad. Vendfy usa esa
            conexión para medir qué campaña generó cada venta.
          </p>
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          {PROVIDERS.map((p) => (
            <Skeleton key={p} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {PROVIDERS.map((provider) => (
            <IntegrationCard
              key={provider}
              provider={provider}
              storeId={storeId}
              connection={conexiones.find((c) => c.provider === provider)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
