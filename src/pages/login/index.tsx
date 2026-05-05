import LoginForm from "@/features/login/ui/LoginForm";
import { Link } from "react-router-dom";
import { VendfyLogo } from "@/shared/ui/VendfyLogo";
import { useTheme } from "@/app/providers/theme";
import { ShoppingBag, Sparkles, BarChart3 } from "lucide-react";

export default function LoginPage() {
  const { theme } = useTheme();
  const resolvedDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Lado izquierdo - Branding (oculto en mobile) */}
      <aside className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-emerald-600 via-emerald-700 to-slate-900 dark:from-emerald-700 dark:via-emerald-900 dark:to-slate-950 overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 25% 25%, white 1px, transparent 1px), radial-gradient(circle at 75% 75%, white 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <VendfyLogo variant="full-white" size={48} />
          </div>

          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold leading-tight mb-3">
                Bienvenido de vuelta
              </h1>
              <p className="text-lg text-emerald-50/90">
                Tu negocio te espera. Gestiona ventas, inventario y clientes desde un solo lugar.
              </p>
            </div>

            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold">Tienda online lista en minutos</p>
                  <p className="text-sm text-emerald-50/75">Comparte tu link y empieza a vender</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold">IA que escribe por ti</p>
                  <p className="text-sm text-emerald-50/75">Descripciones, fichas y banners en un click</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold">Reportes claros</p>
                  <p className="text-sm text-emerald-50/75">Sabes qué vendes, cuánto ganas y qué falta</p>
                </div>
              </li>
            </ul>
          </div>

          <p className="text-xs text-emerald-50/60">
            © {new Date().getFullYear()} Vendfy · Digitaliza tu negocio
          </p>
        </div>
      </aside>

      {/* Lado derecho - Form */}
      <main className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Logo solo en mobile */}
          <div className="flex justify-center mb-8 lg:hidden">
            <VendfyLogo variant={resolvedDark ? "full-white" : "full"} size={42} />
          </div>

          <div className="space-y-2 mb-8">
            <h2 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h2>
            <p className="text-sm text-muted-foreground">
              Ingresa tus datos para acceder a tu panel
            </p>
          </div>

          <LoginForm />

          <p className="text-center text-sm text-muted-foreground mt-6">
            ¿Aún no tienes cuenta?{" "}
            <Link
              to="/register"
              className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
            >
              Crear cuenta gratis
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
