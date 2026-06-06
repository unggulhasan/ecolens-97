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
import { TagInput } from "@/components/ui/tag-input"
import { AutocompleteInput } from "@/components/ui/autocomplete-input"
import { WILDLIFE_SUGGESTIONS } from "@/lib/constants"
import { HugeiconsIcon } from "@hugeicons/react"
import { Upload01Icon, Image01Icon, Video01Icon, Delete02Icon } from "@hugeicons/core-free-icons"
import { formatFileSize, validateUploadedFile } from "@/lib/file-utils"
import { useFileDragAndDrop } from "@/hooks/use-file-drag-drop"
import { useSession } from "next-auth/react"
import { lookupByThumbnail, searchBySpecies, searchByTags } from "@/lib/api"
import { formatFileResults, type FileResult } from "@/lib/file-results"
import { FileResultsPanel } from "@/components/file-results-panel"

type TagCountInput = {
  id: string
  tag: string
  count: number | ""
}

const MAX_SIZE_BYTES = 1024 * 1024 * 1024 // 1GB

export function SearchContainer() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = React.useState<string>("tags-count")
  const nextRowIdRef = React.useRef<number>(2)

  // Tab 1
  const [tagsCount, setTagsCount] = React.useState<TagCountInput[]>([
    { id: "1", tag: "", count: 1 },
  ])

  // Tab 2
  const [tagsOnly, setTagsOnly] = React.useState<string[]>([])

  // Tab 3
  const [thumbnailUrl, setThumbnailUrl] = React.useState<string>("")

  // Tab 4
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)

  // Search state
  const [searching, setSearching] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)
  const [results, setResults] = React.useState<FileResult[] | null>(null)
  const [hasSearched, setHasSearched] = React.useState(false)

  // ---- Search disabled logic ----
  const isSearchDisabled = React.useMemo(() => {
    if (activeTab === "tags-count") {
      return tagsCount.length === 0 || tagsCount.some(row => row.tag.trim() === "" || row.count === "")
    }
    if (activeTab === "tags-only") return tagsOnly.length === 0
    if (activeTab === "thumbnail") return thumbnailUrl.trim() === ""
    if (activeTab === "file") return selectedFile === null
    return true
  }, [activeTab, tagsCount, tagsOnly, thumbnailUrl, selectedFile])

  // ---- Tag row handlers ----
  const addTagRow = () => {
    const nextId = nextRowIdRef.current.toString()
    nextRowIdRef.current += 1
    setTagsCount([...tagsCount, { id: nextId, tag: "", count: 1 }])
  }

  const removeTagRow = (id: string) => {
    if (tagsCount.length === 1) return
    setTagsCount(tagsCount.filter((row) => row.id !== id))
  }

  const updateTagRow = (id: string, field: "tag" | "count", value: string | number) => {
    setTagsCount(tagsCount.map((row) => row.id === id ? { ...row, [field]: value } : row))
  }

  // ---- File handlers ----
  const validateAndSetFile = (file: File) => {
    const errorMsg = validateUploadedFile(file, MAX_SIZE_BYTES)
    if (errorMsg) { setError(errorMsg); return }
    setSelectedFile(file)
  }

  const { dragActive, handleDrag, handleDrop } = useFileDragAndDrop(validateAndSetFile)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) validateAndSetFile(e.target.files[0])
  }

  const removeSelectedFile = () => {
    setSelectedFile(null)
    setError(null)
    const fileInput = document.getElementById("search-file-input") as HTMLInputElement
    if (fileInput) fileInput.value = ""
  }

  // ---- Placeholder search functions ----
  const searchTagsCount = async (tags: TagCountInput[]): Promise<FileResult[]> => {
    const idToken = (session as { idToken?: string })?.idToken
    if (!idToken) {
      throw new Error("Not authenticated. Please log in again.")
    }

    const tagsRecord: Record<string, number> = {}
    tags.forEach((row) => {
      const name = row.tag.trim().toLowerCase()
      if (name) {
        tagsRecord[name] = typeof row.count === "number" ? row.count : 1
      }
    })

    if (Object.keys(tagsRecord).length === 0) {
      throw new Error("Please enter at least one tag/species with count.")
    }

    const data = await searchByTags(idToken, tagsRecord)
    const userEmail = session?.user?.email || ""
    return formatFileResults(data, userEmail)
  }

  const searchTagsOnly = async (tags: string[]): Promise<FileResult[]> => {
    const idToken = (session as { idToken?: string })?.idToken
    if (!idToken) {
      throw new Error("Not authenticated. Please log in again.")
    }
    const species = tags.map((t) => t.trim().toLowerCase()).filter(Boolean)

    if (species.length === 0) {
      throw new Error("Please enter at least one tag/species.")
    }

    const data = await searchBySpecies(idToken, species)
    const userEmail = session?.user?.email || ""
    return formatFileResults(data, userEmail)
  }

  const searchThumbnail = async (url: string): Promise<FileResult[]> => {
    const idToken = (session as { idToken?: string })?.idToken
    if (!idToken) {
      throw new Error("Not authenticated. Please log in again.")
    }
    const data = await lookupByThumbnail(idToken, url)
    const userEmail = session?.user?.email || ""
    return formatFileResults([data], userEmail)
  }

  const searchFile = async (file: File | null): Promise<FileResult[]> => {
    console.log("Searching by uploaded file:", file)
    return new Promise((resolve) => setTimeout(() => resolve([
      {
        url: "https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?w=500&auto=format&fit=crop",
        fullUrl: "https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?w=500&auto=format&fit=crop",
        s3Url: "s3://mock-bucket/images/uuid-1/file1.jpg",
        isOwner: true,
        userId: "you@example.com",
        tags: { kangaroo: 1 },
      },
      {
        url: "https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?w=500&auto=format&fit=crop",
        fullUrl: "https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?w=500&auto=format&fit=crop",
        s3Url: "s3://mock-bucket/images/uuid-2/file2.jpg",
        isOwner: false,
        userId: "other@example.com",
        tags: { dingo: 2 },
      },
    ]), 1000))
  }

  // ---- Search handler ----
  const handleSearch = async () => {
    setHasSearched(true)
    setSearching(true)
    setError(null)
    setResults(null)

    try {
      let data: FileResult[] = []

      if (activeTab === "tags-count") {
        const validTags = tagsCount
          .filter((t) => t.tag.trim() !== "")
          .map((t) => ({ ...t, count: t.count === "" ? 1 : Number(t.count) }))
        if (validTags.length === 0) throw new Error("Please specify at least one tag.")
        data = await searchTagsCount(validTags)
      } else if (activeTab === "tags-only") {
        if (tagsOnly.length === 0) throw new Error("Please input at least one tag/species.")
        data = await searchTagsOnly(tagsOnly)
      } else if (activeTab === "thumbnail") {
        if (!thumbnailUrl.trim()) throw new Error("Please input a thumbnail URL.")
        data = await searchThumbnail(thumbnailUrl)
      } else if (activeTab === "file") {
        if (!selectedFile) throw new Error("Please upload a file (image or video) to search.")
        data = await searchFile(selectedFile)
      }

      setResults(data)
    } catch (err: unknown) {
      console.error(err)
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred during search."
      setError(message)
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
        <Tabs
          defaultValue="tags-count"
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="search-tabs-list">
            <TabsTrigger value="tags-count">
              Tags with Minimum Count
            </TabsTrigger>
            <TabsTrigger value="tags-only">Tags Only</TabsTrigger>
            <TabsTrigger value="thumbnail">Thumbnail&#39;s URL</TabsTrigger>
            <TabsTrigger value="file">File</TabsTrigger>
          </TabsList>

          {/* Tab 1 */}
          <TabsContent value="tags-count" className="space-y-4">
            <div className="search-input-group">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Query Tags</span>
                <Button
                  onClick={addTagRow}
                  variant="outline"
                  size="sm"
                  className="h-8"
                >
                  <svg
                    className="mr-1 size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add Tag
                </Button>
              </div>
              <div className="space-y-3">
                {tagsCount.map((row) => (
                  <div key={row.id} className="search-tag-row">
                    <AutocompleteInput
                      placeholder="Tag name (e.g. wombat)"
                      value={row.tag}
                      onChange={(e) =>
                        updateTagRow(row.id, "tag", e.target.value)
                      }
                      suggestions={WILDLIFE_SUGGESTIONS}
                      className="flex-1 bg-white dark:bg-slate-950"
                    />
                    <Input
                      type="number"
                      min={1}
                      value={row.count}
                      onChange={(e) => {
                        const val = e.target.value
                        updateTagRow(
                          row.id,
                          "count",
                          val === "" ? "" : parseInt(val) || ""
                        )
                      }}
                      onBlur={() => {
                        if (
                          row.count === "" ||
                          isNaN(Number(row.count)) ||
                          Number(row.count) < 1
                        ) {
                          updateTagRow(row.id, "count", 1)
                        }
                      }}
                      className="w-24 bg-white dark:bg-slate-950"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTagRow(row.id)}
                      disabled={tagsCount.length === 1}
                      className="shrink-0 text-destructive hover:bg-destructive/10"
                    >
                      <svg
                        className="size-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Tab 2 */}
          <TabsContent value="tags-only" className="space-y-4">
            <div className="search-input-group">
              <span className="text-sm font-medium">Enter Species/Tags</span>
              <TagInput
                placeholder="Tag name (e.g. wombat)"
                tags={tagsOnly}
                onChange={setTagsOnly}
                suggestions={WILDLIFE_SUGGESTIONS}
                className="bg-white dark:bg-slate-950"
              />
              <p className="text-xs text-muted-foreground">
                Type a tag and press Enter or comma to confirm. Matches files
                that contain at least one of each input tag.
              </p>
            </div>
          </TabsContent>

          {/* Tab 3 */}
          <TabsContent value="thumbnail" className="space-y-4">
            <div className="search-input-group">
              <span className="text-sm font-medium">Thumbnail URL</span>
              <Input
                placeholder="s3://aussie-ecolens-s3-media/thumbnails/thumbnail.png"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                className="bg-white dark:bg-slate-950"
              />
              <p className="text-xs text-muted-foreground">
                Enter the exact S3 URI of the thumbnail to find the original
                full-sized file.
              </p>
            </div>
          </TabsContent>

          {/* Tab 4 */}
          <TabsContent value="file" className="space-y-4">
            <div className="search-input-group">
              <span className="text-sm font-medium">Select File</span>
              <div
                className={`upload-dropzone ${selectedFile ? "disabled" : dragActive ? "drag-active" : "cursor-pointer"}`}
                onDragEnter={selectedFile ? undefined : handleDrag}
                onDragOver={selectedFile ? undefined : handleDrag}
                onDragLeave={selectedFile ? undefined : handleDrag}
                onDrop={selectedFile ? undefined : handleDrop}
                onClick={
                  selectedFile
                    ? undefined
                    : () =>
                        document.getElementById("search-file-input")?.click()
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

          {/* Search button */}
          <div className="mt-6 flex flex-col gap-4 border-t pt-6">
            {error && <div className="upload-error">{error}</div>}
            <div className="flex justify-end">
              <Button
                onClick={handleSearch}
                disabled={searching || isSearchDisabled}
                className="upload-action-button"
              >
                {searching && (
                  <svg
                    className="upload-spinner"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="upload-spinner-circle"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="upload-spinner-path"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
                {searching ? "Searching..." : "Execute Search"}
              </Button>
            </div>
          </div>
        </Tabs>

        {hasSearched && (
          <FileResultsPanel
            title="Search Results"
            results={results}
            loading={searching}
            onResultsChange={setResults}
            emptyMessage="No matching files found."
          />
        )}
      </CardContent>
    </Card>
  )
}
