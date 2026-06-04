"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import type { Session } from "next-auth"

export function SessionWatcher() {
  const { data: session } = useSession() as { data: Session | null }

  useEffect(() => {
    if (session?.error) {
      window.location.assign("/api/auth/federated-logout")
    }
  }, [session?.error])

  return null
}
