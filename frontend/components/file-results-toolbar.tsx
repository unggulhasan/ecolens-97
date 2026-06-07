import * as React from "react"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon, Tag01Icon } from "@hugeicons/core-free-icons"

type FileResultsToolbarProps = {
  title: string
  statusLabel?: string
  detectedTags?: string[] | null
  anySelected: boolean
  selectedCount: number
  othersInSelection: number
  canDelete: boolean
  viewMode: "grid" | "list"
  onViewModeChange: (mode: "grid" | "list") => void
  onEditTags: () => void
  onDeleteFiles: () => void
}

export function FileResultsToolbar({
  title,
  statusLabel,
  detectedTags,
  anySelected,
  selectedCount,
  othersInSelection,
  canDelete,
  viewMode,
  onViewModeChange,
  onEditTags,
  onDeleteFiles,
}: FileResultsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {statusLabel && (
          <span className="text-xs text-muted-foreground">{statusLabel}</span>
        )}
        {detectedTags && detectedTags.length > 0 && (
          <div className="flex items-center gap-1.5 border-l pl-3 ml-1 border-border">
            <span className="text-xs text-muted-foreground font-medium">Inferred Tags:</span>
            <div className="flex flex-wrap gap-1">
              {detectedTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary border border-primary/20 transition-all duration-300 hover:bg-primary/20"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
        {anySelected && (
          <span className="text-xs text-muted-foreground">
            {selectedCount} selected
            {othersInSelection > 0 &&
              ` (${othersInSelection} not yours - delete disabled)`}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
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
        <Button
          size="sm"
          variant="outline"
          disabled={!anySelected}
          onClick={onEditTags}
          className="flex h-8 items-center gap-1.5"
        >
          <HugeiconsIcon icon={Tag01Icon} className="size-3.5" strokeWidth={2} />
          Edit Tags
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!anySelected || !canDelete}
          title={
            othersInSelection > 0
              ? "Deselect other users' files to delete"
              : undefined
          }
          onClick={onDeleteFiles}
          className="flex h-8 items-center gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 disabled:border-border disabled:text-muted-foreground"
        >
          <HugeiconsIcon icon={Delete02Icon} className="size-3.5" strokeWidth={2} />
          Delete Files
        </Button>
      </div>
    </div>
  )
}
