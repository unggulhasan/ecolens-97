"use client"

import * as React from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useFileUpload } from "@/hooks/use-file-upload"
import { UploadDropzone } from "@/components/upload-dropzone"
import { SelectedFileDetails } from "@/components/selected-file-details"
import { UploadSuccessPanel } from "@/components/upload-success-panel"

export default function UploadsPage() {
  const {
    selectedFile,
    error,
    uploadStatus,
    dragActive,
    handleDrag,
    handleDrop,
    handleFileChange,
    removeFile,
    handleUpload,
    isPending,
    hasSelectedFile,
  } = useFileUpload()

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
              <UploadSuccessPanel onReset={removeFile} />
            ) : (
              <>
                <UploadDropzone
                  dragActive={dragActive}
                  handleDrag={handleDrag}
                  handleDrop={handleDrop}
                  handleFileChange={handleFileChange}
                  disabled={hasSelectedFile || isPending}
                />

                {error && <div className="upload-error">{error}</div>}

                {selectedFile && (
                  <SelectedFileDetails
                    file={selectedFile}
                    isPending={isPending}
                    uploadStatus={uploadStatus}
                    onRemove={removeFile}
                    onUpload={handleUpload}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

