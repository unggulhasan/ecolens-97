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
      isCustomIcon: false,
    },
    {
      title: "Uploads",
      url: "/uploads",
      icon: Upload01Icon,
      isCustomIcon: false,
    },
    {
      title: "Subscriptions",
      url: "/subscriptions",
      icon: (
        <svg
          className="size-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
      ),
      isCustomIcon: true,
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
                        {item.isCustomIcon ? (
                          item.icon
                        ) : (
                          <HugeiconsIcon icon={item.icon as any} strokeWidth={2} />
                        )}
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
