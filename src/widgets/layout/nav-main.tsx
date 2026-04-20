"use client"

import { ChevronRight, type LucideIcon } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { useState } from "react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/shared/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
} from "@/shared/ui/collapsible"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
    items?: {
      title: string
      url: string
    }[]
  }[]
}) {
  const location = useLocation()
  const [openItems, setOpenItems] = useState<string[]>([])
  
  const toggleItem = (title: string) => {
    setOpenItems(prev => {
      // Si ya está abierto, no hacer nada (no cerrar al hacer clic en el mismo)
      if (prev.includes(title)) {
        return prev
      }
      // Si está cerrado, cerrar otros y abrir este
      return [title]
    })
  }

  const closeAllItems = () => {
    setOpenItems([])
  }
  
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase tracking-wider text-[0.65rem]">Navegación</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const isActive = location.pathname === item.url
          const hasSubItems = item.items && item.items.length > 0
          const isOpen = openItems.includes(item.title)
          
          // Check if any sub-item is active
          const hasActiveSubItem = hasSubItems && item.items?.some(subItem => location.pathname === subItem.url)
          
          if (hasSubItems) {
            return (
              <Collapsible
                key={item.title}
                asChild
                open={isOpen || hasActiveSubItem}
              >
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={isActive}
                    asChild
                  >
                    <Link
                      to={item.url}
                      onClick={() => toggleItem(item.title)}
                      className="flex items-center transition-all duration-200"
                    >
                      {item.icon && <item.icon className={isActive ? "text-emerald-400" : ""} />}
                      <span className="flex-1">{item.title}</span>
                      {/* <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${isOpen || hasActiveSubItem ? 'rotate-90' : ''}`} /> */}
                    </Link>
                  </SidebarMenuButton>
                  <CollapsibleContent className="overflow-hidden transition-all duration-200 ease-in-out data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                    <SidebarMenuSub>
                      {item.items?.map((subItem) => {
                        const isSubActive = location.pathname === subItem.url
                        return (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton asChild isActive={isSubActive}>
                              <Link to={subItem.url}>
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )
          }

          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
                <Link to={item.url} onClick={closeAllItems} className="transition-all duration-200">
                  {item.icon && <item.icon className={isActive ? "text-emerald-400" : ""} />}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
