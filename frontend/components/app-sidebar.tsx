"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon, Search01Icon, Upload01Icon, Tag01Icon } from "@hugeicons/core-free-icons"

export function AppSidebar() {
  const pathname = usePathname()

  const menuItems = [
    {
      title: "Search",
      url: "/search",
      icon: Search01Icon,
    },
    {
      title: "Uploads",
      url: "/uploads",
      icon: Upload01Icon,
    },
    {
      title: "Manage Tags",
      url: "/manage-tags",
      icon: Tag01Icon,
    },
    {
      title: "Delete Files",
      url: "/delete",
      icon: Delete02Icon,
    },
  ]

    return (
    <Sidebar collapsible="icon">
      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = pathname === item.url
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link href={item.url}>
                        <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
