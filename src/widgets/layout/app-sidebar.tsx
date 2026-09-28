import * as React from "react"
import {
  Sparkles,
  LayoutDashboard,
  // SPRINT 1: ocultos del menú — descomentar junto con sus items
  // ShoppingCart,
  // BarChart3,
  // ClipboardList,
  // DollarSign,
  // MessageCircle,
  // Megaphone,
  // Plug,
  Package,
  Users,
  Store,
  Boxes,
  Truck,
  Tags,
} from "lucide-react"

import { NavMain, type NavSection } from "@/widgets/layout/nav-main"
import { NavUser } from "@/widgets/layout/nav-user"
import { StoreSwitcher } from "@/widgets/layout/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/shared/ui/sidebar"
import { useStore, useAuth } from "@/app/providers/auth"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { selectedStore } = useStore()
  const { user } = useAuth()

  const userData = {
    user: {
      name: user?.name || "Usuario",
      email: user?.email || "",
      avatar: "",
    },
  }

  const sections: NavSection[] = [
    {
      label: "Operación",
      items: [
        // El asistente va PRIMERO: es el punto de entrada del comerciante, no
        // una herramienta más del menú. Es lo que pide el RF-09.
        { title: "Asistente", url: "/omnibox", icon: Sparkles },
        { title: "Inicio", url: "/dashboard", icon: LayoutDashboard },
        // SPRINT 1: fuera del alcance de la demo
        // { title: "Caja", url: "/caja", icon: ShoppingCart },
        // { title: "Pedidos", url: "/orders", icon: ClipboardList },
        // { title: "Ventas", url: "/sales", icon: DollarSign },
      ],
    },
    {
      label: "Catálogo",
      items: [
        { title: "Productos", url: "/products", icon: Package },
        { title: "Inventario", url: "/inventory", icon: Boxes },
        { title: "Compras", url: "/purchases", icon: Truck },
        { title: "Marcas y Categorías", url: "/products/taxonomies", icon: Tags },
      ],
    },
    {
      label: "Clientes",
      items: [{ title: "Clientes", url: "/customers", icon: Users }],
    },
    // SPRINT 1: la sección entera queda oculta. Se comenta completa y no solo
    // sus items, porque una sección sin items igual pinta su encabezado.
    // {
    //   label: "Marketing",
    //   items: [
    //     { title: "WhatsApp", url: "/whatsapp", icon: MessageCircle },
    //     { title: "Campañas", url: "/campaigns", icon: Megaphone },
    //     { title: "Integraciones", url: "/integrations", icon: Plug },
    //   ],
    // },
    {
      label: "Administración",
      items: [
        {
          title: selectedStore === "all" ? "Tiendas" : "Tienda",
          url:
            selectedStore === "all"
              ? "/stores"
              : `/stores/${(selectedStore as any)?.id || ""}`,
          icon: Store,
        },
        // SPRINT 1: oculto junto con su submenú de Movimientos
        // {
        //   title: "Análisis",
        //   url: "/reports",
        //   icon: BarChart3,
        //   items: [{ title: "Movimientos", url: "/reports/movements" }],
        // },
      ],
    },
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <StoreSwitcher />
      </SidebarHeader>
      <SidebarContent className="gap-0">
        <NavMain sections={sections} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
