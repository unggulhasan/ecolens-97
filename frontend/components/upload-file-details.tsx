import * as React from "react"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Image01Icon, Video01Icon, Delete02Icon } from "@hugeicons/core-free-icons"
import { formatFileSize } from "@/lib/file-utils"

export type UploadStatus = "idle" | "converting" | "checksumming" | "presigning" | "uploading" | "success" | "error"

type SelectedFileDetailsProps = {
  file: File
  isPending: boolean
  uploadStatus: UploadStatus
  onRemove: () => void
  onUpload: () => void
}

export function SelectedFileDetails({
  file,
  isPending,
  uploadStatus,
  onRemove,
  onUpload,
}: SelectedFileDetailsProps) {
  const isVideo = file.type.startsWith("video/")

  const getButtonText = () => {
    if (uploadStatus === "converting") return "Converting HEIC..."
    if (uploadStatus === "checksumming") return "Verifying file..."
    if (uploadStatus === "presigning") return "Preparing upload..."
    if (uploadStatus === "uploading") return "Uploading..."
    if (uploadStatus === "error") return "Retry Upload"
    return "Upload File"
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Selected File</h3>
      <div className="selected-file-card">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex-shrink-0 text-muted-foreground">
            <HugeiconsIcon
              icon={isVideo ? Video01Icon : Image01Icon}
              className="size-5"
            />
          </div>
          <span className="truncate font-medium">
            {file.name}
          </span>
          <span className="text-xs text-muted-foreground">
            ({formatFileSize(file.size)})
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="text-destructive hover:bg-destructive/10"
          disabled={isPending}
        >
          <HugeiconsIcon icon={Delete02Icon} className="size-4" />
        </Button>
      </div>

      <div className="upload-action-container">
        <Button onClick={onUpload} disabled={isPending} className="upload-action-button">
          {isPending && (
            <svg className="upload-spinner" fill="none" viewBox="0 0 24 24">
              <circle className="upload-spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="upload-spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {getButtonText()}
        </Button>
      </div>
    </div>
  )
}
