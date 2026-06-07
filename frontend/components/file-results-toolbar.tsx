import * as React from "react"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon, Tag01Icon } from "@hugeicons/core-free-icons"
import { ViewModeToggle, type ViewMode } from "@/components/view-mode-toggle"
import { InferredTagsList } from "@/components/inferred-tags-list"

type FileResultsToolbarProps = {
  title: string
  statusLabel?: string
  detectedTags?: string[] | null
  anySelected: boolean
  selectedCount: number
  othersInSelection: number
  canDelete: boolean
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
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
        {detectedTags && (
          <InferredTagsList tags={detectedTags} />
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
        <ViewModeToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />
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
