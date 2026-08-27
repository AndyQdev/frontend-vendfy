import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Separator } from "@/shared/ui/separator";
import {
  AlertCircle,
  Check,
  ExternalLink,
  Loader2,
  Plug,
  Unplug,
} from "lucide-react";
import {
  PROVIDER_META,
  STATUS_META,
  type IntegrationConnection,
  type IntegrationProvider,
} from "@/entities/integration/model/types";
import {
  useAdAccounts,
  useAuthorizeIntegration,
  useConfigureIntegration,
  useDisconnectIntegration,
} from "@/entities/integration/api";

interface Props {
  provider: IntegrationProvider;
  storeId: string;
  connection?: IntegrationConnection;
}

const TONE: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  warn: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  muted: "bg-muted text-muted-foreground",
};

export function IntegrationCard({ provider, storeId, connection }: Props) {
  const meta = PROVIDER_META[provider];
  const conectado = connection?.status === "connected";

  const [dataset, setDataset] = useState(connection?.datasetId ?? "");
  const autorizar = useAuthorizeIntegration();
  const desconectar = useDisconnectIntegration();
  const configurar = useConfigureIntegration();

  // Las cuentas publicitarias solo se piden si ya hay conexión: sin token la
  // llamada falla y no tiene sentido mostrar el selector.
  const { data: cuentas = [], isLoading: cargandoCuentas } = useAdAccounts(
    storeId,
    conectado && provider === "meta"
  );

  const handleConectar = async () => {
    try {
      const url = await autorizar.mutateAsync({ storeId, provider });
      if (!url) throw new Error("El servidor no devolvió la URL de Meta");
      window.location.assign(url);
    } catch (e) {
      toast.error("No se pudo iniciar la conexión", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const handleDesconectar = async () => {
    try {
      await desconectar.mutateAsync({ storeId, provider });
      toast.success(`${meta.label} desconectado`);
    } catch (e) {
      toast.error("No se pudo desconectar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const handleGuardar = async (campos: {
    adAccountId?: string;
    datasetId?: string;
  }) => {
    try {
      await configurar.mutateAsync({ storeId, provider, ...campos });
      toast.success("Configuración guardada");
    } catch (e) {
      toast.error("No se pudo guardar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const estado = connection ? STATUS_META[connection.status] : null;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: "var(--primary-grad)" }}
          >
            <Plug className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg font-semibold">{meta.label}</h3>
              {estado && (
                <Badge variant="secondary" className={TONE[estado.tone]}>
                  {estado.label}
                </Badge>
              )}
              {!meta.disponible && <Badge variant="outline">Próximamente</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{meta.description}</p>
            {conectado && connection?.externalAccountName && (
              <p className="text-xs text-muted-foreground">
                Cuenta: <strong>{connection.externalAccountName}</strong>
              </p>
            )}
          </div>
        </div>

        {meta.disponible &&
          (conectado ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDesconectar}
              disabled={desconectar.isPending}
            >
              {desconectar.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Unplug className="mr-1.5 h-4 w-4" />
              )}
              Desconectar
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleConectar}
              disabled={autorizar.isPending}
            >
              {autorizar.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-1.5 h-4 w-4" />
              )}
              Conectar
            </Button>
          ))}
      </div>

      {connection?.lastError && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{connection.lastError}</span>
        </div>
      )}

      {conectado && provider === "meta" && (
        <>
          <Separator className="my-5" />
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Cuenta publicitaria</Label>
              <Select
                value={connection?.adAccountId ?? undefined}
                onValueChange={(v) => handleGuardar({ adAccountId: v })}
                disabled={cargandoCuentas || configurar.isPending}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      cargandoCuentas ? "Cargando…" : "Elegí una cuenta"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {cuentas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {c.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Desde acá se lee el gasto para calcular el retorno.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataset">Dataset de conversiones</Label>
              <div className="flex gap-2">
                <Input
                  id="dataset"
                  value={dataset}
                  onChange={(e) => setDataset(e.target.value)}
                  placeholder="1234567890"
                />
                <Button
                  variant="outline"
                  onClick={() => handleGuardar({ datasetId: dataset })}
                  disabled={
                    configurar.isPending || dataset === (connection?.datasetId ?? "")
                  }
                >
                  {configurar.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Destino de los eventos de venta. Está en el Administrador de
                eventos de Meta.
              </p>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
