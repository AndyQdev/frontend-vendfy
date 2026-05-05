import * as React from "react"
import {
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  Settings,
  ClipboardList,
  Store,
  DollarSign,
  Boxes,
  Truck,
  Tags,
  TrendingUp,
  MessageCircle,
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
  SidebarSeparator,
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
        { title: "Caja", url: "/caja", icon: ShoppingCart },
        { title: "Pedidos", url: "/orders", icon: ClipboardList },
        { title: "Ventas", url: "/sales", icon: DollarSign },
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
    {
      label: "Mi Tienda",
      items: [
        {
          title: selectedStore === "all" ? "Tiendas" : "Tienda",
          url:
            selectedStore === "all"
              ? "/stores"
              : `/stores/${(selectedStore as any)?.id || ""}`,
          icon: Store,
        },
        { title: "WhatsApp", url: "/whatsapp", icon: MessageCircle },
      ],
    },
    {
      label: "Análisis",
      items: [
        {
          title: "Estadísticas",
          url: "/reports",
          icon: BarChart3,
          items: [{ title: "Movimientos", url: "/reports/movements" }],
        },
      ],
    },
    {
      label: "Sistema",
      items: [{ title: "Configuración", url: "/settings", icon: Settings }],
    },
  ]

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader>
        <StoreSwitcher />
      </SidebarHeader>
      <SidebarSeparator className="my-1" />
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
