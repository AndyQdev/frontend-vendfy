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

  // Selección automática:
  // 1. Si no hay tienda seleccionada y existen tiendas → seleccionar la primera
  // 2. Si solo hay una tienda y el usuario tenía "all" → forzar esa única tienda
  //    ("Todas las tiendas" no tiene sentido con una sola tienda)
  React.useEffect(() => {
    if (stores.length === 0) return

    if (!selectedStore) {
      setSelectedStore(stores[0])
      return
    }

    if (stores.length === 1 && selectedStore === "all") {
      setSelectedStore(stores[0])
    }
  }, [stores, selectedStore, setSelectedStore])

  const showAllOption = stores.length > 1

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
              <div
                className="flex aspect-square size-9 items-center justify-center rounded-[12px] ring-[3px] ring-primary/15 shadow-[0_8px_22px_-8px_rgba(11,185,129,0.8),inset_0_1px_0_rgba(255,255,255,0.35)]"
                style={{ background: "var(--primary-grad)" }}
              >
                <VendfyIcon size={26} dark />
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
            
            {/* Opción: Todas las tiendas (solo si hay más de una tienda) */}
            {showAllOption && (
              <>
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
              </>
            )}

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
