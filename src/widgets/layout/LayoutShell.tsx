import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Moon, Sun, Bot, Globe } from "lucide-react";
import { useState, useEffect } from "react";
import { useStore } from "@/app/providers/auth";
import { useWhatsAppStatus } from "@/entities/whatsapp/api";
import { AppSidebar } from "@/widgets/layout/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/ui/breadcrumb";
import { Separator } from "@/shared/ui/separator";
import { Button } from "@/shared/ui/button";
import { ButtonMagic } from "@/shared/ui/button-magic";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/shared/ui/sidebar";
import { useTheme } from "@/app/providers/theme";

export default function LayoutShell() {
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedStore } = useStore();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  const storeId = selectedStore && selectedStore !== "all" ? (selectedStore as any).id : undefined;
  const { data: whatsappData } = useWhatsAppStatus(storeId);
  const isWhatsAppConnected = whatsappData?.status === "connected";

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  // Detectar si estamos en la página de caja
  const isCajaPage = location.pathname === '/caja';
  
  // En móvil (< 1024px) mostrar header siempre, en desktop ocultarlo en caja
  const shouldShowHeader = !isCajaPage || isMobile;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Header sticky - En móvil siempre visible, en desktop oculto en caja */}
        {shouldShowHeader && (
          <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4 flex-1">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 h-4"
              />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#" className="text-muted-foreground hover:text-primary transition-colors">
                      Sistema de Ventas
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="font-semibold text-primary">Vista Actual</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2 px-4">
              {/* Web Store Button */}
              {selectedStore && selectedStore !== "all" && (selectedStore as any).slug && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  aria-label="Ver tienda web"
                  onClick={() => window.open(
                    `${import.meta.env.VITE_URL_PUBLIC || 'https://compras.vendfy.shop'}/${(selectedStore as any).slug}`,
                    '_blank'
                  )}
                >
                  <Globe className="h-[1.2rem] w-[1.2rem]" />
                </Button>
              )}

              {/* Bot WhatsApp Button */}
              {isWhatsAppConnected ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/whatsapp")}
                  className="h-9 w-9 relative"
                >
                  <Bot className="h-[1.2rem] w-[1.2rem]" />
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background" />
                </Button>
              ) : (
                <ButtonMagic
                  onClick={() => navigate("/whatsapp")}
                  className="text-xs"
                >
                  <Bot className="h-4 w-4" />
                  <span className="hidden sm:inline">Conectar Bot</span>
                </ButtonMagic>
              )}

              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="h-9 w-9"
                aria-label="Cambiar tema"
              >
                <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
            </div>
          </header>
        )}
        
        {/* Main content area con overflow y padding superior */}
        <main className="flex-1 min-w-0 overflow-auto">
          <div
            className={`flex flex-1 min-w-0 flex-col gap-4 ${
              isCajaPage ? 'p-4' : 'p-4 pt-6'
            }`}
          >
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
