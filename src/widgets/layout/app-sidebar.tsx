import * as React from "react"
import {
  ShoppingCart,
  Package,
  ShoppingBag,
  Users,
  BarChart3,
  Settings,
  ClipboardList,
  Store,
  DollarSign,
  Truck,
} from "lucide-react"

import { NavMain } from "@/widgets/layout/nav-main"
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

  // Navegación principal según vistas.md (orden por frecuencia de uso)
  const navMain = [
    {
      title: "Caja",
      url: "/caja",
      icon: ShoppingCart,
    },
    {
      title: "Pedidos",
      url: "/orders",
      icon: ClipboardList,
    },
    {
      title: "Ventas",
      url: "/sales",
      icon: DollarSign,
    },
    {
      title: "Productos",
      url: "/products",
      icon: Package,
      items: [
        {
          title: "Inventario",
          url: "/inventory",
        },
        {
          title: "Compras",
          url: "/purchases",
        },
        {
          title: "Marcas y Categorías",
          url: "/products/taxonomies",
        },
      ],
    },
    {
      title: "Clientes",
      url: "/customers",
      icon: Users,
    },
    // Entrada dinámica para Tienda/Tiendas
    {
      title: selectedStore === "all" ? "Tiendas" : "Tienda",
      url: selectedStore === "all" ? "/stores" : `/stores/${(selectedStore as any)?.id || ""}`,
      icon: Store,
    },
    {
      title: "Estadísticas",
      url: "/reports",
      icon: BarChart3,
      items: [
        {
          title: "Movimientos",
          url: "/reports/movements",
        },
      ],
    },
    {
      title: "Configuración",
      url: "/settings",
      icon: Settings,
    },
  ]

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader>
        <StoreSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
