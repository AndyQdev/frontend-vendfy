import * as React from "react"
import { ChevronsUpDown, Plus, Store as StoreIcon, Building2 } from "lucide-react"
import { VendfyIcon } from "@/shared/ui/VendfyLogo"
import { useTheme } from "@/app/providers/theme"
import { useQuery } from "@tanstack/react-query"
import { getStores } from "@/entities/store/api"
import { Store } from "@/entities/store/model/types"
import { useStore } from "@/app/providers/auth"
import { useNavigate } from "react-router-dom"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/shared/ui/sidebar"
import { Skeleton } from "@/shared/ui/skeleton"

export function StoreSwitcher() {
  const { isMobile } = useSidebar()
  const { selectedStore, setSelectedStore } = useStore()
  const navigate = useNavigate()
  const { theme } = useTheme()

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ["stores"],
    queryFn: getStores,
  })

  // Establecer la primera tienda como activa cuando se cargan los datos
  React.useEffect(() => {
    if (stores.length > 0 && !selectedStore) {
      setSelectedStore(stores[0])
    }
  }, [stores, selectedStore, setSelectedStore])

  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <Skeleton className="h-12 w-full" />
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (!selectedStore && stores.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            onClick={() => navigate("/stores/new")}
            className="cursor-pointer"
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg border border-dashed">
              <Plus className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">Crear Tienda</span>
              <span className="truncate text-xs text-muted-foreground">Configura tu primera tienda</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (!selectedStore) {
    return null
  }

  const displayName = selectedStore === "all" ? "Todas las tiendas" : selectedStore.name
  const displaySlug = selectedStore === "all" ? "Gestionar todas" : `@${selectedStore.slug}`
  const displayIcon = selectedStore === "all" ? Building2 : StoreIcon

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-white/10">
                <VendfyIcon size={28} dark />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {displayName}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {displaySlug}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Mis Tiendas
            </DropdownMenuLabel>
            
            {/* Opción: Todas las tiendas */}
            <DropdownMenuItem
              onClick={() => setSelectedStore("all")}
              className="gap-2 p-2 cursor-pointer"
            >
              <div className="flex size-6 items-center justify-center rounded-sm border">
                <Building2 className="size-4 shrink-0" />
              </div>
              <div className="flex flex-col flex-1">
                <span className="text-sm font-medium">Todas las tiendas</span>
                <span className="text-xs text-muted-foreground">Gestionar todas</span>
              </div>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Lista de tiendas individuales */}
            {stores.map((store) => (
              <DropdownMenuItem
                key={store.id}
                onClick={() => setSelectedStore(store)}
                className="gap-2 p-2 cursor-pointer"
              >
                <div className="flex size-6 items-center justify-center rounded-sm border">
                  <StoreIcon className="size-4 shrink-0" />
                </div>
                <div className="flex flex-col flex-1">
                  <span className="text-sm font-medium">{store.name}</span>
                  <span className="text-xs text-muted-foreground">@{store.slug}</span>
                </div>
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />
            
            <DropdownMenuItem
              onClick={() => navigate("/stores/new")}
              className="gap-2 p-2 cursor-pointer"
            >
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <Plus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">Agregar tienda</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
