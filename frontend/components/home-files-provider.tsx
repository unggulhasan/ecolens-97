"use client"

import * as React from "react"
import {
  useHomeFilesState,
  type HomeTab,
  type TabState,
  type HomeFilesContextValue,
} from "@/hooks/use-home-files-state"

export type { HomeTab, TabState, HomeFilesContextValue }

const HomeFilesContext = React.createContext<HomeFilesContextValue | null>(null)

export function useHomeFiles() {
  const context = React.useContext(HomeFilesContext)
  if (!context) {
    throw new Error("useHomeFiles must be used within HomeFilesProvider")
  }
  return context
}

export function HomeFilesProvider({ children }: { children: React.ReactNode }) {
  const value = useHomeFilesState()

  return (
    <HomeFilesContext.Provider value={value}>
      {children}
    </HomeFilesContext.Provider>
  )
}
