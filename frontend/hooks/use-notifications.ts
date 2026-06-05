import { useState, useRef, useEffect, useCallback } from "react"
import { fetchNotifications, markNotificationsAsRead, type AppNotification } from "@/lib/subscription-actions"

export function useNotifications() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch notifications from Server Actions
  const loadNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await fetchNotifications()
      setNotifications(data)
    } catch (err) {
      console.error("Failed to load notifications:", err)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  // Poll notifications list every 20 seconds
  useEffect(() => {
    loadNotifications(false)

    const interval = setInterval(() => {
      loadNotifications(true)
    }, 20000)

    return () => clearInterval(interval)
  }, [loadNotifications])

  // Refresh immediately when dropdown is opened to guarantee active presigned URLs
  useEffect(() => {
    if (isOpen) {
      loadNotifications(true)
    }
  }, [isOpen, loadNotifications])

  // Close dropdown if clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  const handleMarkAllRead = useCallback(async () => {
    try {
      // Optimistic update
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      await markNotificationsAsRead()
    } catch (err) {
      console.error("Failed to mark all as read:", err)
      loadNotifications(true)
    }
  }, [loadNotifications])

  const handleMarkSingleRead = useCallback(async (id: string) => {
    try {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
      await markNotificationsAsRead(id)
    } catch (err) {
      console.error("Failed to mark notification as read:", err)
      loadNotifications(true)
    }
  }, [loadNotifications])

  return {
    isOpen,
    setIsOpen,
    notifications,
    loading,
    unreadCount,
    dropdownRef,
    handleMarkAllRead,
    handleMarkSingleRead,
  }
}
