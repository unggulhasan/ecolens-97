"use client"

import { useEffect } from "react"
import { signOut, useSession } from "next-auth/react"
import type { Session } from "next-auth"

export function SessionWatcher() {
  const { data: session } = useSession() as { data: Session | null }

  useEffect(() => {
    if (session?.error) {
      signOut({ callbackUrl: "/login" })
    }
  }, [session?.error])

  return null
}
