"use client"

import * as React from "react"

type SuggestionsListProps = {
  suggestions: string[]
  activeIndex: number
  onSelect: (suggestion: string) => void
}

export function SuggestionsList({
  suggestions,
  activeIndex,
  onSelect,
}: SuggestionsListProps) {
  if (suggestions.length === 0) return null

  return (
    <ul className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-card py-1 text-sm shadow-md focus:outline-none bg-white dark:bg-slate-950">
      {suggestions.map((suggestion, idx) => {
        const isActive = idx === activeIndex
        return (
          <li
            key={suggestion}
            onClick={() => onSelect(suggestion)}
            className={`relative cursor-pointer select-none px-4 py-2 text-foreground ${
              isActive
                ? "bg-primary text-primary-foreground font-medium"
                : "hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {suggestion}
          </li>
        )
      })}
    </ul>
  )
}
