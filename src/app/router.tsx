import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import CajaPage from "@/pages/caja";
import OrdersPage from "@/pages/orders";
import SalesPage from "@/pages/sales";
import ProductsPage from "@/pages/products";
import CreateProductPage from "@/pages/products/create";
import InventoryPage from "@/pages/inventory";
import CustomersPage from "@/pages/customers";
import { StoresPage } from "@/pages/stores";
import { StoreConfigPage } from "@/pages/stores/config";
import ReportsPage from "@/pages/reports";
import SettingsPage from "@/pages/settings";
import LayoutShell from "@/widgets/layout/LayoutShell";
import { useAuth } from "./providers/auth";
import MovementPage from "@/pages/reports/movements";

function Protected() {
  const { user, isLoading } = useAuth();
  
  // Mostrar loader mientras se verifica el token
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando sesión...</p>
        </div>
      </div>
    );
  }
  
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function AppRouter() {
  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      
      {/* Rutas protegidas */}
      <Route element={<Protected />}>
        <Route element={<LayoutShell />}>
          <Route path="/caja" element={<CajaPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/sales" element={<SalesPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/create" element={<CreateProductPage />} />
          <Route path="/products/:id" element={<CreateProductPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/stores" element={<StoresPage />} />
          <Route path="/stores/:id" element={<StoreConfigPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/reports/movements" element={<MovementPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          
          {/* Redirección por defecto a Caja */}
          <Route path="/" element={<Navigate to="/caja" replace />} />
        </Route>
      </Route>
      
      {/* Redirección para rutas no encontradas */}
      <Route path="*" element={<Navigate to="/caja" replace />} />
    </Routes>
  );
}
