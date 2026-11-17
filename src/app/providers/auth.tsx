import { createContext, PropsWithChildren, useContext, useEffect, useState } from "react";
import { apiFetch } from "@/shared/api/client";
import type { Acceso } from "@/shared/acceso/permisos";

interface UserStoreRef {
  id: string;
  name: string;
  slug: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  countryCode?: string;
  role?: {
    id: string;
    name: string;
  };
  onboardingBasic?: boolean;
  onboardingSteps?: number[];
  /** Las tiendas en que trabaja: todas las suyas, o las sucursales asignadas si es empleado. */
  stores?: UserStoreRef[];
  /** Su negocio, su rol, sus permisos y el plan (ver useAcceso). */
  acceso?: Acceso;
}

interface AuthResponse {
  accessToken: string;
  User: User;
}

type AuthCtx = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
};

interface RegisterData {
  name: string;
  email: string;
  password: string;
  phoneNumber: string;
  countryCode: string;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Verificar token al cargar la aplicación
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("authToken");
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const userData = await apiFetch<User>(`/api/auth/checkToken?token=${token}`);
        setUser(userData.data);
        localStorage.setItem("authUser", JSON.stringify(userData.data));
      } catch (error) {
        console.error("Token inválido o expirado:", error);
        localStorage.removeItem("authToken");
        localStorage.removeItem("authUser");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  async function login(email: string, password: string) {
    try {
      const response = await apiFetch<AuthResponse>("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });

      localStorage.setItem("authToken", response.data.accessToken);
      localStorage.setItem("authUser", JSON.stringify(response.data.User));
      setUser(response.data.User);
    } catch (error) {
      console.error("Error en login:", error);
      throw error;
    }
  }

  async function register(data: RegisterData) {
    try {
      const response = await apiFetch<AuthResponse>("/api/auth/register", {
        method: "POST",
        body: data,
      });

      localStorage.setItem("authToken", response.data.accessToken);
      localStorage.setItem("authUser", JSON.stringify(response.data.User));
      setUser(response.data.User);
    } catch (error) {
      console.error("Error en registro:", error);
      throw error;
    }
  }

  function logout() {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    // La tienda elegida también: si no, el siguiente que entre en este
    // navegador la hereda y opera sobre una tienda que nunca eligió —y que
    // puede no ser suya—.
    localStorage.removeItem("selectedStore");
    setUser(null);
  }

  async function refreshUser(): Promise<User | null> {
    const token = localStorage.getItem("authToken");
    if (!token) return null;
    try {
      const userData = await apiFetch<User>(`/api/auth/checkToken?token=${token}`);
      setUser(userData.data);
      localStorage.setItem("authUser", JSON.stringify(userData.data));
      return userData.data;
    } catch (error) {
      console.error("No se pudo refrescar usuario:", error);
      return null;
    }
  }

  return (
    <Ctx.Provider value={{ user, isLoading, login, register, logout, refreshUser }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// ========== STORE CONTEXT ==========

interface Store {
  id: string;
  name: string;
  slug: string;
}

type StoreCtx = {
  selectedStore: Store | "all" | null;
  setSelectedStore: (store: Store | "all") => void;
};

const StoreContext = createContext<StoreCtx | undefined>(undefined);

/**
 * La tienda con la que se está trabajando.
 *
 * Vive en el navegador para que no haya que elegirla en cada visita, y por eso
 * puede quedar una de una SESIÓN ANTERIOR: si después entra otra persona en la
 * misma máquina, el panel entero le manda al backend una tienda que no es suya
 * y todo responde error —sin decir por qué, porque la pantalla se ve normal—.
 * Por eso se valida contra las tiendas del usuario en cuanto se conoce.
 */
export function StoreProvider({ children }: PropsWithChildren) {
  const { user, isLoading } = useAuth();
  const [selectedStore, setSelectedStoreState] = useState<Store | "all" | null>(() => {
    const saved = localStorage.getItem("selectedStore");
    if (!saved) return null;
    if (saved === "all") return "all";
    try {
      return JSON.parse(saved) as Store;
    } catch {
      return null;
    }
  });

  const setSelectedStore = (store: Store | "all") => {
    setSelectedStoreState(store);
    if (store === "all") {
      localStorage.setItem("selectedStore", "all");
    } else {
      localStorage.setItem("selectedStore", JSON.stringify(store));
    }
  };

  /**
   * Descarta la tienda guardada si no es del usuario que entró.
   *
   * Solo actúa con el usuario YA cargado y con tiendas: mientras carga, la
   * lista viene vacía y limpiar ahí borraría una selección buena en cada
   * recarga. "all" no se toca, que no es una tienda concreta.
   */
  useEffect(() => {
    if (isLoading || !user) return;
    // Quien trabaja en algunas sucursales no ve "todas": vuelve a una suya.
    if (selectedStore === "all" && user.acceso?.sucursalesLimitadas) {
      localStorage.removeItem("selectedStore");
      setSelectedStoreState(null);
      return;
    }
    if (!selectedStore || selectedStore === "all") return;

    const propias = user.stores ?? [];
    if (!propias.length) return;

    if (!propias.some((s) => s.id === selectedStore.id)) {
      localStorage.removeItem("selectedStore");
      setSelectedStoreState(null);
    }
  }, [user, isLoading, selectedStore]);

  return (
    <StoreContext.Provider value={{ selectedStore, setSelectedStore }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
