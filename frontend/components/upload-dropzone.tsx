import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Upload01Icon } from "@hugeicons/core-free-icons"

type UploadDropzoneProps = {
  dragActive: boolean
  handleDrag: (e: React.DragEvent) => void
  handleDrop: (e: React.DragEvent) => void
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  disabled: boolean
}

export function UploadDropzone({
  dragActive,
  handleDrag,
  handleDrop,
  handleFileChange,
  disabled,
}: UploadDropzoneProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  return (
    <div
      className={`upload-dropzone ${
        disabled
          ? "disabled"
          : dragActive
            ? "drag-active"
            : "cursor-pointer"
      }`}
      onDragEnter={disabled ? undefined : handleDrag}
      onDragOver={disabled ? undefined : handleDrag}
      onDragLeave={disabled ? undefined : handleDrag}
      onDrop={disabled ? undefined : handleDrop}
      onClick={handleClick}
    >
      <input
        type="file"
        id="file-upload"
        accept="image/*,video/*"
        className="hidden"
        disabled={disabled}
        onChange={handleFileChange}
        ref={fileInputRef}
      />
      <div className="upload-icon-wrapper">
        <HugeiconsIcon
          icon={Upload01Icon}
          className="size-8"
          strokeWidth={2}
        />
      </div>
      <p className="font-medium">
        Drag & drop your file here, or click to select
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Supports image and video files up to 1GB
      </p>
    </div>
  )
}
