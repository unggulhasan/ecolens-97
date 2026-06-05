"use client"

import { usePathname } from "next/navigation"
import { AuthSplitCard } from "@/components/auth-split-card"
import React from "react"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const mode = pathname === "/signup" ? "signup" : "login"

  return (
    <div className="authPage">
      <AuthSplitCard mode={mode} redirectTo="/search" />
      {children}
    </div>
  )
}
