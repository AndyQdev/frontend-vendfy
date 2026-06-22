"use client"

import { type LucideIcon } from "lucide-react"
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

export interface NavItem {
  title: string
  url: string
  icon?: LucideIcon
  badge?: string
  items?: { title: string; url: string }[]
}

export interface NavSection {
  label: string
  items: NavItem[]
}

interface NavMainProps {
  /** New API: agrupar items por secciones */
  sections?: NavSection[]
  /** Legacy: lista plana — se renderiza bajo "Navegación" */
  items?: NavItem[]
}

export function NavMain({ sections, items }: NavMainProps) {
  const location = useLocation()
  const [openItems, setOpenItems] = useState<string[]>([])

  const toggleItem = (title: string) => {
    setOpenItems((prev) => (prev.includes(title) ? prev : [title]))
  }
  const closeAllItems = () => setOpenItems([])

  const renderItems = (list: NavItem[]) =>
    list.map((item) => {
      const isActive =
        location.pathname === item.url ||
        (item.url !== "/" && location.pathname.startsWith(item.url + "/"))
      const hasSubItems = item.items && item.items.length > 0
      const hasActiveSubItem =
        hasSubItems && item.items?.some((sub) => location.pathname === sub.url)
      const isOpen = openItems.includes(item.title)

      if (hasSubItems) {
        return (
          <Collapsible key={item.title} asChild open={isOpen || hasActiveSubItem}>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={item.title} isActive={isActive} asChild>
                <Link
                  to={item.url}
                  onClick={() => toggleItem(item.title)}
                  className="flex items-center transition-all duration-200"
                >
                  {item.icon && <item.icon />}
                  <span className="flex-1">{item.title}</span>
                  {item.badge && (
                    <span className="ml-auto text-[0.65rem] font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                      {item.badge}
                    </span>
                  )}
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
            <Link
              to={item.url}
              onClick={closeAllItems}
              className="transition-all duration-200"
            >
              {item.icon && (
                <item.icon className={isActive ? "text-emerald-500 dark:text-emerald-400" : ""} />
              )}
              <span className="flex-1">{item.title}</span>
              {item.badge && (
                <span className="ml-auto text-[0.65rem] font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                  {item.badge}
                </span>
              )}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )
    })

  // Modo agrupado
  if (sections && sections.length > 0) {
    return (
      <>
        {sections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase tracking-wider text-[0.65rem] font-semibold">
              {section.label}
            </SidebarGroupLabel>
            <SidebarMenu>{renderItems(section.items)}</SidebarMenu>
          </SidebarGroup>
        ))}
      </>
    )
  }

  // Compatibilidad con la API antigua (lista plana)
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase tracking-wider text-[0.65rem] font-semibold">
        Navegación
      </SidebarGroupLabel>
      <SidebarMenu>{renderItems(items || [])}</SidebarMenu>
    </SidebarGroup>
  )
}
