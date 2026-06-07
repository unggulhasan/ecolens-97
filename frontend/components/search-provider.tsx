"use client"

import * as React from "react"
import { SearchContext, useSearchState } from "@/hooks/use-search"

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const value = useSearchState()
  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  )
}
