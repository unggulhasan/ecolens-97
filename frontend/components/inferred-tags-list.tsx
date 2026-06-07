"use client"

import * as React from "react"

type InferredTagsListProps = {
  tags: string[]
}

export function InferredTagsList({ tags }: InferredTagsListProps) {
  if (tags.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 border-l pl-3 ml-1 border-border">
      <span className="text-xs text-muted-foreground font-medium">Inferred Tags:</span>
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary border border-primary/20 transition-all duration-300 hover:bg-primary/20"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}
