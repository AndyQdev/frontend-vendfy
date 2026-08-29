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
  CircleDashed,
  CircleCheck,
  ExternalLink,
  Loader2,
  Plug,
  Unplug,
} from "lucide-react";
import {
  PROVIDER_META,
  STATUS_META,
  capacidadesDeMeta,
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

/** Días que faltan para que caduque el token, o null si no vence. */
function diasParaVencer(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

export function IntegrationCard({ provider, storeId, connection }: Props) {
  const meta = PROVIDER_META[provider];
  const conectado = connection?.status === "connected";

  const [dataset, setDataset] = useState(connection?.datasetId ?? "");
  const [pixel, setPixel] = useState(connection?.pixelId ?? "");
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
    pixelId?: string;
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
  const capacidades = provider === "meta" ? capacidadesDeMeta(connection) : [];
  const listas = capacidades.filter((c) => c.listo).length;
  const dias = diasParaVencer(connection?.expiresAt ?? null);

  return (
    <Card className={meta.disponible ? "p-6" : "p-4"}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className={`flex shrink-0 items-center justify-center rounded-xl text-white ${
              meta.disponible ? "h-11 w-11" : "h-9 w-9 opacity-40"
            }`}
            style={{ background: "var(--primary-grad)" }}
          >
            <Plug className={meta.disponible ? "h-5 w-5" : "h-4 w-4"} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3
                className={`font-display font-semibold ${
                  meta.disponible ? "text-lg" : "text-base"
                }`}
              >
                {meta.label}
              </h3>
              {estado && (
                <Badge variant="secondary" className={TONE[estado.tone]}>
                  {estado.label}
                </Badge>
              )}
              {conectado && capacidades.length > 0 && (
                <Badge
                  variant="secondary"
                  className={
                    TONE[listas === capacidades.length ? "ok" : "warn"]
                  }
                >
                  {listas} de {capacidades.length} funciones activas
                </Badge>
              )}
              {!meta.disponible && <Badge variant="outline">Próximamente</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{meta.description}</p>
            {conectado && connection?.externalAccountName && (
              <p className="text-xs text-muted-foreground">
                Cuenta: <strong>{connection.externalAccountName}</strong>
                {dias !== null && (
                  <>
                    {" · "}
                    <span className={dias <= 7 ? "text-amber-600" : undefined}>
                      {dias > 0
                        ? `la sesión con Meta vence en ${dias} días`
                        : "la sesión con Meta venció: reconectá"}
                    </span>
                  </>
                )}
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
          {/* Qué habilita la conexión, en lugar de campos sueltos: el
              comerciante no sabe qué es un dataset, sabe qué quiere medir. */}
          <Separator className="my-5" />
          <div className="space-y-3">
            {capacidades.map((c) => (
              <div key={c.clave} className="flex items-start gap-3">
                {c.listo ? (
                  <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="space-y-0.5">
                  <p
                    className={`text-sm font-medium ${
                      c.listo ? "" : "text-muted-foreground"
                    }`}
                  >
                    {c.titulo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.listo ? c.descripcion : c.falta}
                  </p>
                </div>
              </div>
            ))}
          </div>

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

            <CampoId
              id="dataset"
              label="Conjunto de datos de WhatsApp"
              valor={dataset}
              onChange={setDataset}
              guardado={connection?.datasetId ?? ""}
              guardando={configurar.isPending}
              onGuardar={() => handleGuardar({ datasetId: dataset })}
              ayuda="Destino de las ventas cerradas en conversación."
            />

            <CampoId
              id="pixel"
              label="Pixel de la tienda web"
              valor={pixel}
              onChange={setPixel}
              guardado={connection?.pixelId ?? ""}
              guardando={configurar.isPending}
              onGuardar={() => handleGuardar({ pixelId: pixel })}
              ayuda="Va separado del de WhatsApp: quien navega y quien escribe no son el mismo público."
            />
          </div>
        </>
      )}
    </Card>
  );
}

/** Campo de identificador externo con guardado explícito. */
function CampoId({
  id,
  label,
  valor,
  onChange,
  guardado,
  guardando,
  onGuardar,
  ayuda,
}: {
  id: string;
  label: string;
  valor: string;
  onChange: (v: string) => void;
  guardado: string;
  guardando: boolean;
  onGuardar: () => void;
  ayuda: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder="1234567890"
        />
        <Button
          variant="outline"
          onClick={onGuardar}
          disabled={guardando || valor === guardado}
        >
          {guardando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{ayuda}</p>
    </div>
  );
}
