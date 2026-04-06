import LoginForm from "@/features/login/ui/LoginForm";
import { Link } from "react-router-dom";
import { VendfyLogo } from "@/shared/ui/VendfyLogo";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <VendfyLogo variant="full-white" size={44} />
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-center mb-6">Iniciar sesión</h2>
          <LoginForm />
          <div className="text-center mt-6">
            <Link to="/register" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
              Crear cuenta nueva
            </Link>
          </div>
        </div>
        <p className="text-center text-xs text-slate-500 mt-6">
          Vendfy - Digitaliza tu negocio
        </p>
      </div>
    </div>
  );
}
