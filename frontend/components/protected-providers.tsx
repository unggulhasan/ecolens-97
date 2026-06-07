"use client"

import { HomeFilesProvider } from "@/components/home-files-provider"
import { SearchProvider } from "@/components/search-provider"

export function ProtectedProviders({ children }: { children: React.ReactNode }) {
  return (
    <HomeFilesProvider>
      <SearchProvider>{children}</SearchProvider>
    </HomeFilesProvider>
  )
}
