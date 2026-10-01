import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import McpConnectPage from "@/pages/mcp-connect";
import OnboardingPage from "@/pages/onboarding";
// El dashboard dejó de ser la vista principal: ahora lo es el asistente.
// Se deja comentado, no borrado, por si se retoma.
// import DashboardPage from "@/pages/dashboard"; // oculto para la presentación del Sprint 1
import CajaPage from "@/pages/caja";
import OrdersPage from "@/pages/orders";
import SalesPage from "@/pages/sales";
import ProductsPage from "@/pages/products";
import CreateProductPage from "@/pages/products/create";
import ProductTaxonomiesPage from "@/pages/products/taxonomies";
import InventoryPage from "@/pages/inventory";
import LivePage from "@/pages/live";
import PrepararLivePage from "@/pages/live/preparar";
import ControlLivePage from "@/pages/live/control";
import CustomersPage from "@/pages/customers";
import { StoresPage } from "@/pages/stores";
import { StoreConfigPage } from "@/pages/stores/config";
import ReportsPage from "@/pages/reports";
import SettingsPage from "@/pages/settings";
// import WhatsAppPage from "@/pages/whatsapp"; // oculto para la presentación del Sprint 1
import CampaignsPage from "@/pages/campaigns";
import IntegrationsPage from "@/pages/integrations";
import LayoutShell from "@/widgets/layout/LayoutShell";
import { useAuth } from "./providers/auth";
import MovementPage from "@/pages/reports/movements";
import PurchasesPage from "@/pages/purchases";
import PurchaseCreatePage from "@/pages/purchases/create";
import PurchaseDetailPage from "@/pages/purchases/detail";
import VendfyLoader from "@/shared/loading/VendfyLoader";
import { OnboardingGuard } from "./guards/OnboardingGuard";
import { OmniboxPage } from "@/features/omnibox/ui/OmniboxPage";

function Protected() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    const stored = localStorage.getItem("theme");
    const isDark = stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    return <VendfyLoader theme={isDark ? "dark" : "light"} message="Verificando sesión..." />;
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function AppRouter() {
  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {/* Puente OAuth del MCP (External Sign-in URI de WorkOS); maneja su propia auth */}
      <Route path="/mcp-connect" element={<McpConnectPage />} />

      {/* Rutas protegidas (con auth) */}
      <Route element={<Protected />}>
        {/* Onboarding: requiere auth pero NO el guard (es donde el usuario va a "completarlo") */}
        <Route element={<OnboardingGuard />}>
          <Route path="/onboarding" element={<OnboardingPage />} />

          {/* Resto de la app: requiere onboarding completo */}
          <Route element={<LayoutShell />}>
            {/* WhatsApp oculto para la presentación del Sprint 1. */}
            <Route path="/omnibox" element={<OmniboxPage />} />
            {/* <Route path="/dashboard" element={<DashboardPage />} /> */}
            <Route path="/dashboard" element={<Navigate to="/caja" replace />} />
            <Route path="/caja" element={<CajaPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/create" element={<CreateProductPage />} />
            <Route path="/products/taxonomies" element={<ProductTaxonomiesPage />} />
            <Route path="/products/:id" element={<CreateProductPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/live" element={<LivePage />} />
            <Route path="/live/:id/preparar" element={<PrepararLivePage />} />
            <Route path="/live/:id/control" element={<ControlLivePage />} />
            <Route path="/purchases" element={<PurchasesPage />} />
            <Route path="/purchases/new" element={<PurchaseCreatePage />} />
            <Route path="/purchases/:id" element={<PurchaseDetailPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/stores" element={<StoresPage />} />
            <Route path="/stores/:id" element={<StoreConfigPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/movements" element={<MovementPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            {/* <Route path="/whatsapp" element={<WhatsAppPage />} /> */}
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/integrations" element={<IntegrationsPage />} />

            {/* Redirección por defecto al inicio */}
            <Route path="/" element={<Navigate to="/caja" replace />} />
          </Route>
        </Route>
      </Route>

      {/* Redirección para rutas no encontradas */}
      <Route path="*" element={<Navigate to="/caja" replace />} />
    </Routes>
  );
}
