import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/auth";
import { apiFetch, ApiError } from "@/shared/api/client";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Separator } from "@/shared/ui/separator";
import {
  AlertCircle,
  Bot,
  Check,
  Loader2,
  Lock,
  Store,
  UserRound,
} from "lucide-react";

interface Props {
  externalAuthId: string;
}

const READ_SCOPES = [
  "Ver tus tiendas y su configuración (branding, contacto, delivery)",
  "Ver productos, categorías y reseñas publicadas",
  "Leer la guía técnica para construir tu web conectada",
];

export default function McpConnectCard({ externalAuthId }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const handleConnect = async () => {
    setError("");
    setConnecting(true);
    try {
      const response = await apiFetch<{ redirect_uri: string }>(
        "/api/mcp/oauth/complete",
        { method: "POST", body: { external_auth_id: externalAuthId } }
      );
      const redirectUri = response.data?.redirect_uri;
      if (!redirectUri) {
        throw new ApiError("El servidor no devolvió la URL de retorno", 502);
      }
      // Continúa el flujo OAuth: WorkOS entrega el código al asistente de IA
      window.location.assign(redirectUri);
    } catch (err) {
      setError(
        err instanceof ApiError && err.message
          ? err.message
          : "No se pudo completar la conexión. Intenta de nuevo."
      );
      setConnecting(false);
    }
  };

  return (
    <Card className="w-full max-w-md p-6 sm:p-8">
      <div className="flex flex-col items-center text-center space-y-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/20">
            <Bot className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-muted-foreground text-lg font-medium">⇄</div>
          <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/20">
            <Store className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Conectar tu cuenta Vendfy
        </h1>
        <p className="text-sm text-muted-foreground">
          Un asistente de IA quiere conectarse a tu cuenta para ayudarte a
          crear la web de tu tienda.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3 mb-6">
        <div className="h-9 w-9 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
          <UserRound className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{user?.name}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </div>
      </div>

      <div className="space-y-2.5 mb-6">
        <p className="text-sm font-medium">Este asistente podrá:</p>
        <ul className="space-y-2">
          {READ_SCOPES.map((scope) => (
            <li key={scope} className="flex items-start gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{scope}</span>
            </li>
          ))}
        </ul>
        <p className="flex items-start gap-2 text-xs text-muted-foreground pt-1">
          <Lock className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Acceso de solo lectura. No podrá modificar tus tiendas, productos,
            pedidos ni datos de clientes.
          </span>
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 text-destructive px-3 py-2.5 rounded-md text-sm mb-4">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-3">
        <Button
          className="w-full h-11"
          onClick={handleConnect}
          disabled={connecting}
        >
          {connecting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Conectando...
            </>
          ) : (
            `Conectar como ${user?.email}`
          )}
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigate("/caja")}
          disabled={connecting}
        >
          Cancelar
        </Button>
      </div>

      <Separator className="my-4" />
      <button
        type="button"
        className="w-full text-center text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
        onClick={logout}
        disabled={connecting}
      >
        ¿No eres tú? Cambiar de cuenta
      </button>
    </Card>
  );
}
