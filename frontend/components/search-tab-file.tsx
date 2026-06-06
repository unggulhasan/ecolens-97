import * as React from "react"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Upload01Icon,
  Video01Icon,
  Image01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons"
import { formatFileSize } from "@/lib/file-utils"

type SearchTabFileProps = {
  selectedFile: File | null
  dragActive: boolean
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  removeSelectedFile: () => void
  handleDrag: (e: React.DragEvent) => void
  handleDrop: (e: React.DragEvent) => void
}

export function SearchTabFile({
  selectedFile,
  dragActive,
  handleFileChange,
  removeSelectedFile,
  handleDrag,
  handleDrop,
}: SearchTabFileProps) {
  return (
    <div className="search-input-group">
      <span className="text-sm font-medium">Select File</span>
      <div
        className={`upload-dropzone ${
          selectedFile
            ? "disabled"
            : dragActive
              ? "drag-active"
              : "cursor-pointer"
        }`}
        onDragEnter={selectedFile ? undefined : handleDrag}
        onDragOver={selectedFile ? undefined : handleDrag}
        onDragLeave={selectedFile ? undefined : handleDrag}
        onDrop={selectedFile ? undefined : handleDrop}
        onClick={
          selectedFile
            ? undefined
            : () => document.getElementById("search-file-input")?.click()
        }
      >
        <input
          type="file"
          id="search-file-input"
          accept="image/*,video/*"
          className="hidden"
          disabled={!!selectedFile}
          onChange={handleFileChange}
        />
        <div className="upload-icon-wrapper">
          <HugeiconsIcon
            icon={Upload01Icon}
            className="size-8"
            strokeWidth={2}
          />
        </div>
        <p className="text-sm font-medium">
          Drag & drop your file here, or click to select
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Supports image and video files
        </p>
      </div>
      {selectedFile && (
        <div className="mt-4 space-y-3">
          <h3 className="text-sm font-semibold">Selected File</h3>
          <div className="selected-file-card">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex-shrink-0 text-muted-foreground">
                <HugeiconsIcon
                  icon={
                    selectedFile.type.startsWith("video/")
                      ? Video01Icon
                      : Image01Icon
                  }
                  className="size-5"
                />
              </div>
              <span className="truncate font-medium">{selectedFile.name}</span>
              <span className="text-xs text-muted-foreground">
                ({formatFileSize(selectedFile.size)})
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                removeSelectedFile()
              }}
              className="text-destructive hover:bg-destructive/10"
            >
              <HugeiconsIcon icon={Delete02Icon} className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
