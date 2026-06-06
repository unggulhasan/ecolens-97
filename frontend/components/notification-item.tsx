import * as React from "react"
import { type AppNotification } from "@/lib/subscription-actions"

// Format timestamp to a relative time string
const formatTime = (isoString: string) => {
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    if (diffMs < 0) return "Just now"

    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`

    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  } catch {
    return "Recently"
  }
}

type NotificationItemProps = {
  notification: AppNotification
  onMarkRead: (id: string) => void
}

export function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  return (
    <div
      onClick={() => onMarkRead(notification.id)}
      className={`flex items-start gap-3 p-3 transition-colors hover:bg-muted/40 cursor-pointer relative ${
        !notification.read ? "bg-primary/5 hover:bg-primary/10" : ""
      }`}
    >
      {/* Unread Status Dot */}
      {!notification.read && (
        <span className="absolute top-4 left-2.5 flex h-2 w-2 rounded-full bg-primary" />
      )}

      <div className={`flex-1 ${!notification.read ? "pl-2.5" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <p className={`text-xs font-semibold ${!notification.read ? "text-foreground" : "text-muted-foreground"}`}>
            {notification.title}
          </p>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {formatTime(notification.timestamp)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-normal">
          {notification.message}
        </p>

        {/* Species Badge & File Link */}
        <div className="flex items-center gap-2 mt-2">
          {notification.tag && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary uppercase tracking-wider">
              {notification.tag}
            </span>
          )}
          {notification.file_url && (
            <a
              href={notification.file_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              View File
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
