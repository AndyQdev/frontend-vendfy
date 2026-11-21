import { Routes, Route, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import McpConnectPage from "@/pages/mcp-connect";
import GuiaPage from "@/pages/guia";
import OnboardingPage from "@/pages/onboarding";
// El dashboard ya no es la vista principal -ahora lo es el asistente- pero
// sigue siendo una pantalla propia, alcanzable desde el carril.
import DashboardPage from "@/pages/dashboard";
import CajaPage from "@/pages/caja";
import OrdersPage from "@/pages/orders";
import SalesPage from "@/pages/sales";
import ProductsPage from "@/pages/products";
import CreateProductPage from "@/pages/products/create";
import ProductTaxonomiesPage from "@/pages/products/taxonomies";
import InventoryPage from "@/pages/inventory";
import LivePage from "@/pages/live";
import SesionLivePage from "@/pages/live/sesion";
import CustomersPage from "@/pages/customers";
import { StoresPage } from "@/pages/stores";
import { StoreConfigPage } from "@/pages/stores/config";
import ReportsPage from "@/pages/reports";
import MarketingPage from "@/pages/marketing";
import CampanaPage from "@/pages/marketing/campana";
import AgentePage from "@/pages/marketing/agente";
import PromotionsPage from "@/pages/promotions";
import LayoutShell from "@/widgets/layout/LayoutShell";
import { useAuth } from "./providers/auth";
import MovementPage from "@/pages/reports/movements";
import PurchasesPage from "@/pages/purchases";
import PurchaseCreatePage from "@/pages/purchases/create";
import PurchaseDetailPage from "@/pages/purchases/detail";
import VendfyLoader from "@/shared/loading/VendfyLoader";
import { OnboardingGuard } from "./guards/OnboardingGuard";
import { OmniboxPage } from "@/features/omnibox/ui/OmniboxPage";
import EquipoPage from "@/pages/equipo";
import { PrimeraRuta } from "./guards/PrimeraRuta";

function Protected() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    const stored = localStorage.getItem("theme");
    const isDark = stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    return <VendfyLoader theme={isDark ? "dark" : "light"} message="Verificando sesión..." />;
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

function RedirigirASesion() {
  const { id } = useParams();
  return <Navigate to={`/live/${id}`} replace />;
}

/** Las rutas viejas de WhatsApp e Integraciones llevan al módulo de Marketing, con sus parámetros. */
function AMarketing() {
  const { search } = useLocation();
  return <Navigate to={`/marketing${search}`} replace />;
}

export default function AppRouter() {
  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {/* Puente OAuth del MCP (External Sign-in URI de WorkOS); maneja su propia auth */}
      <Route path="/mcp-connect" element={<McpConnectPage />} />
      {/* Guía de uso con capturas: pública, para quien todavía no tiene cuenta */}
      <Route path="/guia" element={<GuiaPage />} />

      {/* Rutas protegidas (con auth) */}
      <Route element={<Protected />}>
        {/* Onboarding: requiere auth pero NO el guard (es donde el usuario va a "completarlo") */}
        <Route element={<OnboardingGuard />}>
          <Route path="/onboarding" element={<OnboardingPage />} />

          {/* Resto de la app: requiere onboarding completo */}
          <Route element={<LayoutShell />}>
            <Route path="/omnibox" element={<OmniboxPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/caja" element={<CajaPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/create" element={<CreateProductPage />} />
            <Route path="/products/taxonomies" element={<ProductTaxonomiesPage />} />
            <Route path="/products/:id" element={<CreateProductPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/live" element={<LivePage />} />
            <Route path="/live/:id" element={<SesionLivePage />} />
            {/* Preparar y control eran dos pantallas y ahora son una. Las
                direcciones viejas siguen existiendo porque quedaron en enlaces
                compartidos y en el historial del navegador. */}
            <Route path="/live/:id/preparar" element={<RedirigirASesion />} />
            <Route path="/live/:id/control" element={<RedirigirASesion />} />
            <Route path="/purchases" element={<PurchasesPage />} />
            <Route path="/purchases/new" element={<PurchaseCreatePage />} />
            <Route path="/purchases/:id" element={<PurchaseDetailPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/stores" element={<StoresPage />} />
            <Route path="/stores/:id" element={<StoreConfigPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/movements" element={<MovementPage />} />
            {/* WhatsApp e Integraciones viven ahora dentro de Marketing (con sus callbacks: ?success, ?meta, ?config). */}
            <Route path="/whatsapp" element={<AMarketing />} />
            <Route path="/promotions" element={<PromotionsPage />} />
            <Route path="/marketing" element={<MarketingPage />} />
            <Route path="/marketing/agente" element={<AgentePage />} />
            <Route path="/marketing/campanas/:id" element={<CampanaPage />} />
            <Route path="/campaigns" element={<Navigate to="/marketing" replace />} />
            <Route path="/integrations" element={<AMarketing />} />
            <Route path="/equipo" element={<EquipoPage />} />

            {/* Redirección por defecto: la primera pantalla que puede usar */}
            <Route path="/" element={<PrimeraRuta />} />
          </Route>
        </Route>
      </Route>

      {/* Redirección para rutas no encontradas */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
