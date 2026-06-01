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
import { Upload01Icon, File01Icon, Delete02Icon } from "@hugeicons/core-free-icons"

export default function UploadsPage() {
  const [dragActive, setDragActive] = React.useState(false)
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([])

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
      const files = Array.from(e.dataTransfer.files)
      setSelectedFiles((prev) => [...prev, ...files])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const files = Array.from(e.target.files)
      setSelectedFiles((prev) => [...prev, ...files])
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="flex-1 p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Uploads</h1>
          <p className="text-muted-foreground">Upload and manage your ecological data files.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>File Upload</CardTitle>
            <CardDescription>
              Drag and drop your files here, or click to browse.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center cursor-pointer transition-colors ${
                dragActive ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50"
              }`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              <input
                type="file"
                id="file-upload"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="bg-primary/10 p-4 rounded-full text-primary mb-4">
                <HugeiconsIcon icon={Upload01Icon} className="size-8" strokeWidth={2} />
              </div>
              <p className="font-medium">Drag & drop files here, or click to select</p>
              <p className="text-xs text-muted-foreground mt-1">Supports PDF, CSV, TXT up to 10MB</p>
            </div>

            {selectedFiles.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="font-semibold text-sm">Selected Files ({selectedFiles.length})</h3>
                <div className="border rounded-lg divide-y bg-card">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 text-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-muted-foreground flex-shrink-0">
                          <HugeiconsIcon icon={File01Icon} className="size-5" />
                        </div>
                        <span className="truncate font-medium">{file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeFile(idx)
                        }}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={() => alert("Upload functionality not implemented yet.")}>
                    Upload Files
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
