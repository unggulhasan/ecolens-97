import * as React from "react"
import { getPresignedUrl } from "@/lib/upload-actions"
import { calculateChecksum, uploadFileToS3 } from "@/lib/s3-client"
import { validateUploadedFile } from "@/lib/file-utils"
import { useFileDragAndDrop } from "@/hooks/use-file-drag-drop"
import type { UploadStatus } from "@/components/upload-file-details"

const MAX_SIZE_BYTES = 1024 * 1024 * 1024 // 1GB

export function useFileUpload() {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [checksum, setChecksum] = React.useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = React.useState<UploadStatus>("idle")

  const validateAndSetFile = React.useCallback(async (file: File) => {
    setError(null)
    setUploadStatus("idle")

    let targetFile = file
    const isHeic = file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif")

    if (isHeic) {
      setUploadStatus("converting")
      try {
        const heic2anyModule = await import("heic2any")
        const heic2any = heic2anyModule.default
        const converted = await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.85,
        })
        const blobResult = Array.isArray(converted) ? converted[0] : converted
        targetFile = new File([blobResult], file.name.replace(/\.(heic|heif)$/i, ".jpg"), {
          type: "image/jpeg",
        })
        setUploadStatus("idle")
      } catch (err: any) {
        console.error("HEIC conversion error:", err)
        setError("Failed to convert HEIC image. Please try uploading a JPG or PNG.")
        setUploadStatus("error")
        return
      }
    }

    const errorMsg = validateUploadedFile(targetFile, MAX_SIZE_BYTES)
    if (errorMsg) {
      setError(errorMsg)
      return
    }

    setSelectedFile(targetFile)
  }, [])

  const { dragActive, handleDrag, handleDrop } = useFileDragAndDrop(validateAndSetFile)

  const handleFileChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0])
    }
  }, [validateAndSetFile])

  const removeFile = React.useCallback(() => {
    setSelectedFile(null)
    setError(null)
    setChecksum(null)
    setUploadStatus("idle")
    const fileInput = document.getElementById("file-upload") as HTMLInputElement
    if (fileInput) {
      fileInput.value = ""
    }
  }, [])

  const handleUpload = React.useCallback(async () => {
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
  }, [selectedFile])

  const isPending = uploadStatus === "converting" || uploadStatus === "checksumming" || uploadStatus === "presigning" || uploadStatus === "uploading"
  const hasSelectedFile = !!selectedFile

  return {
    selectedFile,
    error,
    checksum,
    uploadStatus,
    dragActive,
    handleDrag,
    handleDrop,
    handleFileChange,
    removeFile,
    handleUpload,
    isPending,
    hasSelectedFile,
  }
}
