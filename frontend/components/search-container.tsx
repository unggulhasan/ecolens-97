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
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import { Upload01Icon, Image01Icon, Video01Icon, Delete02Icon } from "@hugeicons/core-free-icons"

type TagCountInput = {
  id: string
  tag: string
  count: number
}

export function SearchContainer() {
  const [activeTab, setActiveTab] = React.useState<string>("tags-count")
  
  // Tab 1: Tags with Minimum Count state
  const [tagsCount, setTagsCount] = React.useState<TagCountInput[]>([
    { id: "1", tag: "kangaroo", count: 1 },
  ])

  // Tab 2: Tags Only state
  const [tagsOnly, setTagsOnly] = React.useState<string>("")

  // Tab 3: Thumbnail URL state
  const [thumbnailUrl, setThumbnailUrl] = React.useState<string>("")

  // Tab 4: File Search state
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [dragActive, setDragActive] = React.useState<boolean>(false)

  // Common Search UI state
  const [searching, setSearching] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)
  const [results, setResults] = React.useState<string[] | null>(null)

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    }
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  // Handle adding/removing tag inputs for Tab 1
  const addTagRow = () => {
    const nextId = (tagsCount.length + 1).toString()
    setTagsCount([...tagsCount, { id: nextId, tag: "", count: 1 }])
  }

  const removeTagRow = (id: string) => {
    if (tagsCount.length === 1) return
    setTagsCount(tagsCount.filter((row) => row.id !== id))
  }

  const updateTagRow = (id: string, field: "tag" | "count", value: string | number) => {
    setTagsCount(
      tagsCount.map((row) => {
        if (row.id === id) {
          return { ...row, [field]: value }
        }
        return row
      })
    )
  }

  // Handle file selection for Tab 4 (image or video)
  const validateAndSetFile = (file: File) => {
    setError(null)
    
    const isImage = file.type.startsWith("image/")
    const isVideo = file.type.startsWith("video/")
    if (!isImage && !isVideo) {
      setError("Only image and video files are allowed.")
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

  const removeSelectedFile = () => {
    setSelectedFile(null)
    setError(null)
    const fileInput = document.getElementById("search-file-input") as HTMLInputElement
    if (fileInput) {
      fileInput.value = ""
    }
  }

  // Placeholder search API functions (to be integrated later)
  const searchTagsCount = async (tags: TagCountInput[]): Promise<string[]> => {
    // TODO: Implement actual query to /q1_tags_count
    console.log("Searching tags with minimum count:", tags)
    // Simulating response payload
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          "https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?w=500&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?w=500&auto=format&fit=crop",
        ])
      }, 1000)
    })
  }

  const searchTagsOnly = async (tagsString: string): Promise<string[]> => {
    // TODO: Implement actual query to /q2_species
    console.log("Searching species/tags only:", tagsString)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          "https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?w=500&auto=format&fit=crop",
        ])
      }, 1000)
    })
  }

  const searchThumbnail = async (url: string): Promise<string[]> => {
    // TODO: Implement actual query to /q3_thumbnail
    console.log("Searching by thumbnail URL:", url)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          "https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?w=500&auto=format&fit=crop",
        ])
      }, 1000)
    })
  }

  const searchFile = async (file: File | null): Promise<string[]> => {
    // TODO: Implement actual query to /q4_file_tags
    console.log("Searching by uploaded file (image/video):", file)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          "https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?w=500&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?w=500&auto=format&fit=crop",
        ])
      }, 1000)
    })
  }

  // Trigger search action
  const handleSearch = async () => {
    setSearching(true)
    setError(null)
    setResults(null)

    try {
      let data: string[] = []

      if (activeTab === "tags-count") {
        const validTags = tagsCount.filter((t) => t.tag.trim() !== "")
        if (validTags.length === 0) {
          throw new Error("Please specify at least one tag.")
        }
        data = await searchTagsCount(validTags)
      } else if (activeTab === "tags-only") {
        if (!tagsOnly.trim()) {
          throw new Error("Please input at least one tag/species.")
        }
        data = await searchTagsOnly(tagsOnly)
      } else if (activeTab === "thumbnail") {
        if (!thumbnailUrl.trim()) {
          throw new Error("Please input a thumbnail URL.")
        }
        data = await searchThumbnail(thumbnailUrl)
      } else if (activeTab === "file") {
        if (!selectedFile) {
          throw new Error("Please upload a file (image or video) to search.")
        }
        data = await searchFile(selectedFile)
      }

      setResults(data)
    } catch (err: any) {
      console.error(err)
      setError(err.message || "An unexpected error occurred during search.")
    } finally {
      setSearching(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Search Parameters</CardTitle>
        <CardDescription>
          Select a search category and enter your query terms.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="tags-count" onValueChange={setActiveTab} className="w-full">
          <TabsList className="search-tabs-list">
            <TabsTrigger value="tags-count">
              Tags with Minimum Count
            </TabsTrigger>
            <TabsTrigger value="tags-only">
              Tags Only
            </TabsTrigger>
            <TabsTrigger value="thumbnail">
              Thumbnail&#39;s URL
            </TabsTrigger>
            <TabsTrigger value="file">
              File
            </TabsTrigger>
          </TabsList>

          {/* Content 1: Tags with Minimum Count */}
          <TabsContent value="tags-count" className="space-y-4">
            <div className="search-input-group">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Query Tags</span>
                <Button onClick={addTagRow} variant="outline" size="sm" className="h-8">
                  <svg className="size-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Tag
                </Button>
              </div>
              <div className="space-y-3">
                {tagsCount.map((row) => (
                  <div key={row.id} className="search-tag-row">
                    <Input
                      placeholder="Tag name (e.g. kangaroo)"
                      value={row.tag}
                      onChange={(e) => updateTagRow(row.id, "tag", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min={1}
                      placeholder="Min Count"
                      value={row.count}
                      onChange={(e) => updateTagRow(row.id, "count", parseInt(e.target.value) || 1)}
                      className="w-24"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTagRow(row.id)}
                      disabled={tagsCount.length === 1}
                      className="text-destructive hover:bg-destructive/10 shrink-0"
                    >
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Content 2: Tags Only */}
          <TabsContent value="tags-only" className="space-y-4">
            <div className="search-input-group">
              <span className="text-sm font-medium">Enter Species/Tags</span>
              <Input
                placeholder="Comma separated list (e.g. kangaroo, wombat)"
                value={tagsOnly}
                onChange={(e) => setTagsOnly(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Matches files that contain at least one of each input tag.
              </p>
            </div>
          </TabsContent>

          {/* Content 3: Thumbnail URL */}
          <TabsContent value="thumbnail" className="space-y-4">
            <div className="search-input-group">
              <span className="text-sm font-medium">Thumbnail URL</span>
              <Input
                placeholder="s3://aussie-ecolens-s3-media/images/thumbnail.png"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter the exact S3 URI of the thumbnail to find the original full-sized file.
              </p>
            </div>
          </TabsContent>

          {/* Content 4: File Search */}
          <TabsContent value="file" className="space-y-4">
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
                <p className="font-medium text-sm">
                  Drag & drop your file here, or click to select
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Supports image and video files
                </p>
              </div>

              {selectedFile && (
                <div className="space-y-3 mt-4">
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
          </TabsContent>

          {/* Trigger button and states */}
          <div className="flex flex-col gap-4 pt-6 border-t mt-6">
            {error && (
              <div className="upload-error">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSearch} disabled={searching} className="upload-action-button">
                {searching && (
                  <svg className="upload-spinner" fill="none" viewBox="0 0 24 24">
                    <circle className="upload-spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="upload-spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {searching ? "Searching..." : "Execute Search"}
              </Button>
            </div>
          </div>
        </Tabs>

        {/* Results Panel */}
        {searching && (
          <div className="search-results-grid">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        )}

        {results && results.length > 0 && (
          <div className="space-y-3 pt-6 border-t mt-6">
            <h3 className="text-sm font-semibold">Search Results</h3>
            <div className="search-results-grid">
              {results.map((url, index) => {
                const isVideo =
                  url.toLowerCase().endsWith(".mp4") ||
                  url.toLowerCase().endsWith(".mov") ||
                  url.toLowerCase().endsWith(".avi")
                return (
                  <div key={index} className="search-result-card">
                    {isVideo ? (
                      <video src={url} controls className="search-result-video" />
                    ) : (
                      <img src={url} alt={`Result ${index + 1}`} className="search-result-image" />
                    )}
                    <div className="search-result-overlay">
                      <a href={url} target="_blank" rel="noopener noreferrer" className="search-result-link">
                        View Full File
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {results && results.length === 0 && (
          <div className="pt-6 border-t mt-6">
            <div className="search-no-results">
              <p className="text-muted-foreground">No matching files found.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
