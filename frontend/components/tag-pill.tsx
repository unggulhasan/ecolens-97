"use client"

import * as React from "react"

type TagPillProps = {
  tag: string
  onRemove: () => void
  disabled?: boolean
}

export function TagPill({ tag, onRemove, disabled = false }: TagPillProps) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-0.5 text-xs font-semibold text-secondary-foreground border border-border"
    >
      <span>{tag}</span>
      {!disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation() // Prevent container click and inputs triggering
            onRemove()
          }}
          className="text-muted-foreground hover:text-foreground shrink-0 focus:outline-none"
          aria-label={`Remove tag ${tag}`}
        >
          <svg
            className="size-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </span>
  )
}
