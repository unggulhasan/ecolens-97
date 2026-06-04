"use client"

import { useState, useRef, useEffect } from "react"

type Notification = {
  id: string
  title: string
  message: string
  timestamp: string
  read: boolean
}

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "notif-1",
      title: "Upload Successful",
      message: "Your video kangaroo_jumping.mp4 has been processed and saved successfully.",
      timestamp: "5 mins ago",
      read: false,
    },
    {
      id: "notif-2",
      title: "Eastern Grey Kangaroo Detected",
      message: "Our ML model successfully identified an Eastern Grey Kangaroo in file kangaroo_jumping.mp4.",
      timestamp: "10 mins ago",
      read: false,
    },
    {
      id: "notif-3",
      title: "New User Registered",
      message: "Welcome to Aussie Ecolens portal. Start exploring wildlife uploads.",
      timestamp: "2 hours ago",
      read: true,
    },
  ])

  const dropdownRef = useRef<HTMLDivElement>(null)

  // WebSocket Connection for Real-time AWS SNS notifications
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080"
    let socket: WebSocket | null = null
    let reconnectTimeout: NodeJS.Timeout

    function connect() {
      console.log(`[WebSocket] Connecting to: ${wsUrl}`)
      socket = new WebSocket(wsUrl)

      socket.onopen = () => {
        console.log("[WebSocket] Connection established successfully.")
      }

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          // Expecting SNS message payload structure
          if (data.title && data.message) {
            const newNotif: Notification = {
              id: data.id || Math.random().toString(36).substring(2, 9),
              title: data.title,
              message: data.message,
              timestamp: "Just now",
              read: false,
            }
            setNotifications((prev) => [newNotif, ...prev])
          }
        } catch (err) {
          console.error("[WebSocket] Failed to parse message data:", err)
        }
      }

      socket.onerror = (error) => {
        console.warn("[WebSocket] Error occurred:", error)
      }

      socket.onclose = () => {
        console.log("[WebSocket] Connection closed. Attempting reconnect in 5s...")
        reconnectTimeout = setTimeout(connect, 5000)
      }
    }

    connect()

    // Simulation of a dynamic AWS SNS notification event over WebSocket after 15 seconds
    const simulationTimeout = setTimeout(() => {
      const mockSnsEvent: Notification = {
        id: Math.random().toString(36).substring(2, 9),
        title: "AWS SNS: Image Classification Complete",
        message: "Emu detected in upload_emu_04.jpg. Processing completed.",
        timestamp: "Just now",
        read: false,
      }
      setNotifications((prev) => [mockSnsEvent, ...prev])
    }, 15000)

    return () => {
      if (socket) {
        socket.onclose = null // disable reconnect logic on unmount
        socket.close()
      }
      clearTimeout(reconnectTimeout)
      clearTimeout(simulationTimeout)
    }
  }, [])

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

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  return (
    <div className="notification-dropdown-container" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="notification-dropdown-trigger"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Notifications"
      >
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
        {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notification-dropdown-menu">
          <div className="notification-dropdown-header">
            <span className="notification-dropdown-title">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="notification-mark-read-btn">
                Mark all as read
              </button>
            )}
          </div>
          <div className="notification-list">
            {notifications.length > 0 ? (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`notification-item notification-item-unclickable ${
                    !notif.read ? "notification-item-unread" : ""
                  }`}
                >
                  {!notif.read && <div className="notification-status-dot" />}
                  <div className="notification-content">
                    <p className="notification-item-title">{notif.title}</p>
                    <p className="notification-item-message">{notif.message}</p>
                    <p className="notification-item-time">{notif.timestamp}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="notification-empty">
                <span className="notification-empty-text">No notifications</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
