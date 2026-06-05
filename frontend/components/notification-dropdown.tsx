"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useNotifications } from "@/hooks/use-notifications"
import { NotificationItem } from "@/components/notification-item"

export function NotificationDropdown() {
  const {
    isOpen,
    setIsOpen,
    notifications,
    loading,
    unreadCount,
    dropdownRef,
    handleMarkAllRead,
    handleMarkSingleRead,
  } = useNotifications()

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative hover:bg-muted/60 transition-all rounded-full h-9 w-9 text-muted-foreground hover:text-foreground"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Notifications"
      >
        <svg
          className="h-[20px] w-[20px]"
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
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-background animate-pulse">
            {unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown Box */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-80 origin-top-right rounded-xl border bg-background/95 backdrop-blur-md p-1 shadow-xl ring-1 ring-black/5 focus:outline-none z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <Button
                variant="link"
                onClick={handleMarkAllRead}
                className="h-auto p-0 text-xs text-primary font-medium hover:text-primary/80"
              >
                Mark all as read
              </Button>
            )}
          </div>
          <Separator className="my-1 bg-muted/80" />

          {/* List Area */}
          <div className="max-h-96 overflow-y-auto pr-0.5 scrollbar-thin">
            {loading && notifications.length === 0 ? (
              // Loading Skeleton State
              <div className="space-y-2 p-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-3 p-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-1/3" />
                      <Skeleton className="h-3.5 w-5/6" />
                      <Skeleton className="h-2.5 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length > 0 ? (
              <div className="divide-y divide-muted/40">
                {notifications.map((notif) => (
                  <NotificationItem
                    key={notif.id}
                    notification={notif}
                    onMarkRead={handleMarkSingleRead}
                  />
                ))}
              </div>
            ) : (
              // Empty State
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <svg
                  className="h-10 w-10 text-muted-foreground/60 mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a9.001 9.001 0 01-11.714 0M14.857 17.082a9.001 9.001 0 00-11.714 0M14.857 17.082l-.499-.074m0 0a9.03 9.03 0 01-1.127-.197m0 0L3.75 18M12 21V3m0 18l-3-3m3 3l3-3M3.75 6h16.5M3.75 12h16.5"
                  />
                </svg>
                <span className="text-xs text-muted-foreground font-medium">
                  No notifications
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

