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
import { getPresignedUrl } from "@/auth-actions"

const MAX_SIZE_BYTES = 1024 * 1024 * 1024 // 1GB

type UploadStatus = "idle" | "checksumming" | "presigning" | "uploading" | "success" | "error"

export default function UploadsPage() {
  const [dragActive, setDragActive] = React.useState(false)
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [checksum, setChecksum] = React.useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = React.useState<UploadStatus>("idle")

  const validateAndSetFile = (file: File) => {
    setError(null)
    setUploadStatus("idle")
    
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
    setChecksum(null)
    setUploadStatus("idle")
    const fileInput = document.getElementById("file-upload") as HTMLInputElement
    if (fileInput) {
      fileInput.value = ""
    }
  }

  const calculateChecksum = async (file: File): Promise<string> => {
    const fileBuffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer)
    const bytes = new Uint8Array(hashBuffer)
    let binary = ""
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
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
      const uploadResponse = await fetch(presignData.url, {
        method: "PUT",
        headers: {
          "Content-Type": selectedFile.type,
          "x-amz-checksum-sha256": computedChecksum,
          "x-amz-meta-user-email": presignData.user_email,
        },
        body: selectedFile,
      })

      if (!uploadResponse.ok) {
        throw new Error(`S3 upload failed with status code ${uploadResponse.status}`)
      }

      setUploadStatus("success")
      setSelectedFile(null)
    } catch (err: any) {
      console.error("Upload process error:", err)
      setError(err.message || "Failed to upload file. Please try again.")
      setUploadStatus("error")
    }
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
                  Your image or video has been checksummed and securely uploaded to S3.
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
                        disabled={isPending}
                      >
                        <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                      </Button>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button onClick={handleUpload} disabled={isPending}>
                        {uploadStatus === "checksumming" && "Calculating Checksum..."}
                        {uploadStatus === "presigning" && "Requesting Presigned URL..."}
                        {uploadStatus === "uploading" && "Uploading to S3..."}
                        {uploadStatus === "idle" && "Upload File"}
                        {uploadStatus === "error" && "Retry Upload"}
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
