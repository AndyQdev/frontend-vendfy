import { useNavigate } from "react-router-dom";
import { ChevronDown, Globe, LogOut, Menu, MessageCircle, Moon, Store, Sun } from "lucide-react";

import { OpcionInstalar, limpiarCachesDelServiceWorker } from "@/features/pwa";

import { useAuth } from "@/app/providers/auth";
import { useTheme } from "@/app/providers/theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { cn } from "@/shared/lib/cn";

/** "Andrés Rojas Pérez" → "Andrés R." */
export function shortName(name: string): string {
  const [first, second] = name.trim().split(/\s+/);
  if (!first) return "Usuario";
  return second ? `${first} ${second[0].toUpperCase()}.` : first;
}

/** "Andrés Rojas" → "AR" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  return ((parts[0][0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * El perfil: avatar con iniciales, nombre corto y rol. En el teléfono se
 * reduce a un botón de menú, y adentro aparece también el enlace a la tienda
 * online, que en escritorio tiene su propio botón (el globo).
 */
export function UserMenu({
  storeUrl,
  urlVendfy = null,
}: {
  /** La que el comerciante enseña: la propia si la cargó, si no la de Vendfy. */
  storeUrl: string | null;
  /**
   * La de Vendfy, solo cuando hay una propia distinta. Las dos conviven: ahí
   * siguen viviendo el Modo Live y el seguimiento de pedidos.
   */
  urlVendfy?: string | null;
}) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const name = user?.name || "Usuario";
  const role = user?.role?.name || "Usuario";
  const isDark =
    theme === "dark" || (theme === "system" && document.documentElement.classList.contains("dark"));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Menú de la cuenta"
        className={cn(
          "group flex flex-none items-center rounded-full transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          // Teléfono: botón redondo de menú.
          "size-10 justify-center hover:bg-muted",
          // Escritorio: avatar + nombre + rol.
          "lg:size-auto lg:gap-2.5 lg:rounded-xl lg:py-1 lg:pl-1 lg:pr-2 lg:hover:bg-muted lg:data-[state=open]:bg-muted"
        )}
      >
        <Menu className="size-5 lg:hidden" />
        <span className="hidden size-8 flex-none place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground lg:grid">
          {initials(name)}
        </span>
        <span className="hidden min-w-0 flex-col text-left leading-tight lg:flex">
          <span className="max-w-[9rem] truncate text-[13px] font-bold text-foreground">{shortName(name)}</span>
          <span className="max-w-[9rem] truncate text-[11px] text-muted-foreground">{role}</span>
        </span>
        <ChevronDown className="hidden size-4 flex-none text-muted-foreground transition-transform duration-150 group-data-[state=open]:rotate-180 lg:block" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={10} className="w-64">
        <div className="flex items-center gap-3 px-2.5 pb-2.5 pt-2">
          <span className="grid size-9 flex-none place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {initials(name)}
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[13px] font-bold">{name}</span>
            <span className="truncate text-[11px] text-muted-foreground">{user?.email}</span>
          </span>
        </div>
        <DropdownMenuSeparator />

        {storeUrl ? (
          <DropdownMenuItem className="lg:hidden" onSelect={() => window.open(storeUrl, "_blank", "noopener,noreferrer")}>
            <Globe />
            Ver tienda online
          </DropdownMenuItem>
        ) : null}
        {urlVendfy ? (
          <DropdownMenuItem onSelect={() => window.open(urlVendfy, "_blank", "noopener,noreferrer")}>
            <Store />
            Tienda de Vendfy
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => navigate("/marketing?config=connection")}>
          <MessageCircle />
          Vincular WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            // No cerrar: se ve el cambio y se puede volver a tocar.
            event.preventDefault();
            setTheme(isDark ? "light" : "dark");
          }}
        >
          {isDark ? <Sun /> : <Moon />}
          {isDark ? "Modo claro" : "Modo oscuro"}
        </DropdownMenuItem>

        <OpcionInstalar />

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:bg-destructive-soft focus:text-destructive-soft-foreground"
          onSelect={() => {
            // En un mostrador el equipo se comparte: deja la máquina limpia
            // para quien entre después.
            limpiarCachesDelServiceWorker();
            logout();
            // `replace`: sin esto, "atrás" vuelve a dibujar un instante la
            // pantalla del panel antes de que el guard la eche.
            navigate("/login", { replace: true });
          }}
        >
          <LogOut />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
