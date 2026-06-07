"use client"

import * as React from "react"
import { TableRow, TableCell } from "@/components/ui/table"
import { isVideoFile, type FileResult } from "@/lib/file-results"
import { ListCheckbox } from "@/components/list-checkbox"

type FileResultRowProps = {
  result: FileResult
  index: number
  isSelected: boolean
  onToggleSelect: (url: string) => void
}

export function FileResultRow({
  result,
  index,
  isSelected,
  onToggleSelect,
}: FileResultRowProps) {
  const isVideo = isVideoFile(result.s3Url)

  return (
    <TableRow
      className={`cursor-pointer select-none transition-colors ${
        isSelected
          ? "bg-primary/5 hover:bg-primary/10"
          : index % 2 === 0
            ? "bg-background hover:bg-muted/50"
            : "bg-muted/20 hover:bg-muted/50"
      }`}
      onClick={() => onToggleSelect(result.s3Url)}
    >
      <TableCell>
        <ListCheckbox checked={isSelected} />
      </TableCell>
      <TableCell>
        <div className="h-12 w-12 overflow-hidden rounded-lg bg-muted">
          {isVideo ? (
            <video
              src={result.url}
              className="h-full w-full object-cover"
            />
          ) : (
            <img
              src={result.url}
              alt={`Result ${index + 1}`}
              className="h-full w-full object-cover"
            />
          )}
        </div>
      </TableCell>
      <TableCell className="max-w-xs">
        <a
          href={result.fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate block text-xs text-black underline-offset-2 hover:underline max-w-xs"
          onClick={(e) => e.stopPropagation()}
        >
          {result.s3Url}
        </a>
      </TableCell>
      <TableCell>
        {Object.keys(result.tags).length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {Object.keys(result.tags).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary uppercase tracking-wider"
              >
                {tag} ({result.tags[tag]})
              </span>
            ))}
          </div>
        ) : (
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            -
          </span>
        )}
      </TableCell>
      <TableCell>
        {result.isOwner ? (
          <div className="flex flex-col">
            <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary mb-0.5">
              You
            </span>
            <span className="text-[10px] text-muted-foreground">
              {result.userId}
            </span>
          </div>
        ) : (
          <span
            className="text-xs text-muted-foreground"
            title={result.userId}
          >
            {result.userId || "Other user"}
          </span>
        )}
      </TableCell>
    </TableRow>
  )
}
