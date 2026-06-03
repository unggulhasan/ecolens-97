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
import { getPresignedUrl } from "@/lib/upload-actions"
import { calculateChecksum, uploadFileToS3 } from "@/lib/s3-client"
import { formatFileSize, validateUploadedFile } from "@/lib/file-utils"
import { useFileDragAndDrop } from "@/hooks/use-file-drag-drop"

const MAX_SIZE_BYTES = 1024 * 1024 * 1024 // 1GB

type UploadStatus = "idle" | "checksumming" | "presigning" | "uploading" | "success" | "error"

export default function UploadsPage() {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [checksum, setChecksum] = React.useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = React.useState<UploadStatus>("idle")

  const validateAndSetFile = (file: File) => {
    setError(null)
    setUploadStatus("idle")
    
    const errorMsg = validateUploadedFile(file, MAX_SIZE_BYTES)
    if (errorMsg) {
      setError(errorMsg)
      return
    }
    
    setSelectedFile(file)
  }

  const { dragActive, handleDrag, handleDrop } = useFileDragAndDrop(validateAndSetFile)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0])
    }
  }

  const removeFile = () => {
    setSelectedFile(null)
    setError(null)
    setChecksum(null)
    setUploadStatus("idle")
    const fileInput = document.getElementById("file-upload") as HTMLInputElement
    if (fileInput) {
      fileInput.value = ""
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setError(null)
    setChecksum(null)
    
    try {
      // 1. Calculate file checksum
      setUploadStatus("checksumming")
      const computedChecksum = await calculateChecksum(selectedFile)
      setChecksum(computedChecksum)

      // 2. Request S3 presigned URL
      setUploadStatus("presigning")
      const presignData = await getPresignedUrl(
        selectedFile.name,
        selectedFile.type,
        computedChecksum
      )

      // 3. Upload raw file bytes directly to S3
      setUploadStatus("uploading")
      await uploadFileToS3(
        presignData.url,
        selectedFile,
        computedChecksum,
        presignData.user_email,
        presignData.file_id
      )

      setUploadStatus("success")
      setSelectedFile(null)
    } catch (err: any) {
      console.error("Upload process error:", err)
      let displayError = err.message || "Failed to upload file. Please try again."
      const lowerError = displayError.toLowerCase()
      if (lowerError.includes("403") || lowerError.includes("forbidden") || lowerError.includes("duplicate")) {
        displayError = "Upload failed (duplicate file)"
      }
      setError(displayError)
      setUploadStatus("error")
    }
  }

  const isPending = uploadStatus === "checksumming" || uploadStatus === "presigning" || uploadStatus === "uploading"
  const hasSelectedFile = !!selectedFile

  return (
    <div className="page-container">
      <div className="page-content-wrapper">
        <div className="page-header">
          <h1 className="page-title">Uploads</h1>
          <p className="page-description">
            Upload and manage your ecological data files.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>File Upload</CardTitle>
            <CardDescription>
              Upload a single image or video file (up to 1GB).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {uploadStatus === "success" ? (
              <div className="upload-success">
                <span className="upload-success-title">File Uploaded Successfully!</span>
                <p className="text-sm opacity-80">
                  Your image or video has been securely uploaded to S3.
                </p>
                <div className="pt-2">
                  <Button onClick={removeFile} variant="outline">
                    Upload Another File
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div
                  className={`upload-dropzone ${
                    hasSelectedFile || isPending
                      ? "disabled"
                      : dragActive
                        ? "drag-active"
                        : "cursor-pointer"
                  }`}
                  onDragEnter={hasSelectedFile || isPending ? undefined : handleDrag}
                  onDragOver={hasSelectedFile || isPending ? undefined : handleDrag}
                  onDragLeave={hasSelectedFile || isPending ? undefined : handleDrag}
                  onDrop={hasSelectedFile || isPending ? undefined : handleDrop}
                  onClick={
                    hasSelectedFile || isPending
                      ? undefined
                      : () => document.getElementById("file-upload")?.click()
                  }
                >
                  <input
                    type="file"
                    id="file-upload"
                    accept="image/*,video/*"
                    className="hidden"
                    disabled={hasSelectedFile || isPending}
                    onChange={handleFileChange}
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

                {error && <div className="upload-error">{error}</div>}

                {selectedFile && (
                  <div className="space-y-3">
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
                        <span className="truncate font-medium">
                          {selectedFile.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({formatFileSize(selectedFile.size)})
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
                        disabled={isPending}
                      >
                        <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                      </Button>
                    </div>

                    <div className="upload-action-container">
                      <Button onClick={handleUpload} disabled={isPending} className="upload-action-button">
                        {isPending && (
                          <svg className="upload-spinner" fill="none" viewBox="0 0 24 24">
                            <circle className="upload-spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="upload-spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        )}
                        {isPending ? "Uploading..." : uploadStatus === "error" ? "Retry Upload" : "Upload File"}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
