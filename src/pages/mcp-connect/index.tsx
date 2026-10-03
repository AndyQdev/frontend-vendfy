import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/app/providers/auth";
import { useTheme } from "@/app/providers/theme";
import { VendfyLogo } from "@/shared/ui/VendfyLogo";
import VendfyLoader from "@/shared/loading/VendfyLoader";
import { Card } from "@/shared/ui/card";
import { AlertCircle } from "lucide-react";
import McpConnectCard from "@/features/mcp-connect/ui/McpConnectCard";

/**
 * External Sign-in URI de WorkOS AuthKit ("Standalone Connect").
 * WorkOS redirige aquí con ?external_auth_id= cuando un asistente de IA
 * inicia el flujo OAuth del MCP. Con sesión activa mostramos el
 * consentimiento; sin sesión, pasamos por el login y volvemos.
 */
export default function McpConnectPage() {
  const { user, isLoading } = useAuth();
  const { theme } = useTheme();
  const [searchParams] = useSearchParams();
  const externalAuthId = searchParams.get("external_auth_id");

  const resolvedDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isLoading) {
    return (
      <VendfyLoader
        theme={resolvedDark ? "dark" : "light"}
        message="Verificando sesión..."
      />
    );
  }

  if (!externalAuthId) {
    return (
      <Shell resolvedDark={resolvedDark}>
        <Card className="w-full max-w-md p-8 text-center space-y-3">
          <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
          <h1 className="text-xl font-semibold">Enlace de conexión inválido</h1>
          <p className="text-sm text-muted-foreground">
            Falta el identificador de la solicitud. Vuelve a tu asistente de IA
            e inicia la conexión con Vendfy de nuevo.
          </p>
        </Card>
      </Shell>
    );
  }

  if (!user) {
    const returnTo = `/mcp-connect?external_auth_id=${encodeURIComponent(externalAuthId)}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(returnTo)}`} replace />;
  }

  return (
    <Shell resolvedDark={resolvedDark}>
      <McpConnectCard externalAuthId={externalAuthId} />
    </Shell>
  );
}

function Shell({
  resolvedDark,
  children,
}: {
  resolvedDark: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-8 p-6 bg-background">
      <VendfyLogo variant={resolvedDark ? "full-white" : "full"} size={40} />
      {children}
      <p className="text-xs text-muted-foreground">
        © {new Date().getFullYear()} Vendfy · Conexión segura vía OAuth
      </p>
    </main>
  );
}
