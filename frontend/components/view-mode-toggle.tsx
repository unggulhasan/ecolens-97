"use client"

import * as React from "react"

export type ViewMode = "grid" | "list"

type ViewModeToggleProps = {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

export function ViewModeToggle({ viewMode, onViewModeChange }: ViewModeToggleProps) {
  return (
    <div className="flex items-center rounded-md border border-border overflow-hidden">
      <button
        onClick={() => onViewModeChange("list")}
        title="List view"
        className={`flex h-9 w-9 items-center justify-center transition-colors ${
          viewMode === "list"
            ? "bg-primary text-primary-foreground"
            : "bg-background text-muted-foreground hover:bg-accent"
        }`}
      >
        <svg
          className="size-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <button
        onClick={() => onViewModeChange("grid")}
        title="Icons view"
        className={`flex h-9 w-9 items-center justify-center transition-colors ${
          viewMode === "grid"
            ? "bg-primary text-primary-foreground"
            : "bg-background text-muted-foreground hover:bg-accent"
        }`}
      >
        <svg
          className="size-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </button>
    </div>
  )
}
