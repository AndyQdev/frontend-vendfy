import { createContext, PropsWithChildren, useContext, useEffect, useState } from "react";
import { apiFetch } from "@/shared/api/client";

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
  stores?: UserStoreRef[];
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

export function StoreProvider({ children }: PropsWithChildren) {
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
