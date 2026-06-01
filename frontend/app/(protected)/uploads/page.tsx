"use client"

import * as React from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Upload01Icon, Image01Icon, Video01Icon, Delete02Icon } from "@hugeicons/core-free-icons"

const MAX_SIZE_BYTES = 1024 * 1024 * 1024 // 1GB

export default function UploadsPage() {
  const [dragActive, setDragActive] = React.useState(false)
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const validateAndSetFile = (file: File) => {
    setError(null)
    
    // Check type (image or video)
    const isImage = file.type.startsWith("image/")
    const isVideo = file.type.startsWith("video/")
    if (!isImage && !isVideo) {
      setError("Only image and video files are allowed.")
      return
    }
    
    // Check size (up to 1GB)
    if (file.size > MAX_SIZE_BYTES) {
      setError("File size exceeds the 1GB limit.")
      return
    }
    
    setSelectedFile(file)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0])
    }
  }

  const removeFile = () => {
    setSelectedFile(null)
    setError(null)
  }

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    }
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return (
    <div className="page-container">
      <div className="page-content-wrapper">
        <div className="page-header">
          <h1 className="page-title">Uploads</h1>
          <p className="page-description">Upload and manage your ecological data files.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>File Upload</CardTitle>
            <CardDescription>
              Upload a single image or video file (up to 1GB).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              onClick={selectedFile ? undefined : () => document.getElementById("file-upload")?.click()}
            >
              <input
                type="file"
                id="file-upload"
                accept="image/*,video/*"
                className="hidden"
                disabled={!!selectedFile}
                onChange={handleFileChange}
              />
              <div className="upload-icon-wrapper">
                <HugeiconsIcon icon={Upload01Icon} className="size-8" strokeWidth={2} />
              </div>
              <p className="font-medium">Drag & drop your file here, or click to select</p>
              <p className="text-xs text-muted-foreground mt-1">Supports image and video files up to 1GB</p>
            </div>

            {error && (
              <div className="upload-error">
                {error}
              </div>
            )}

            {selectedFile && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Selected File</h3>
                <div className="selected-file-card">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-muted-foreground flex-shrink-0">
                      <HugeiconsIcon
                        icon={selectedFile.type.startsWith("video/") ? Video01Icon : Image01Icon}
                        className="size-5"
                      />
                    </div>
                    <span className="truncate font-medium">{selectedFile.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({formatSize(selectedFile.size)})
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile()
                    }}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                  </Button>
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={() => alert("Upload functionality not implemented yet.")}>
                    Upload File
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
