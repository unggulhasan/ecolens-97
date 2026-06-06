import * as React from "react"
import { Button } from "@/components/ui/button"

type UploadSuccessPanelProps = {
  onReset: () => void
}

export function UploadSuccessPanel({ onReset }: UploadSuccessPanelProps) {
  return (
    <div className="upload-success">
      <span className="upload-success-title">File Uploaded Successfully!</span>
      <p className="text-sm opacity-80">
        Your image or video has been securely uploaded to S3.
      </p>
      <div className="pt-2">
        <Button onClick={onReset} variant="outline">
          Upload Another File
        </Button>
      </div>
    </div>
  )
}
