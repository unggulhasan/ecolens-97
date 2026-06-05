"use client"

import { HomeFilesProvider } from "@/components/home-files-provider"

export function ProtectedProviders({ children }: { children: React.ReactNode }) {
  return <HomeFilesProvider>{children}</HomeFilesProvider>
}
