"use client"

import * as React from "react"
import { createPortal } from "react-dom"
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
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { HugeiconsIcon } from "@hugeicons/react"
import { Upload01Icon, Image01Icon, Video01Icon, Delete02Icon, Tag01Icon } from "@hugeicons/core-free-icons"
import { formatFileSize, validateUploadedFile } from "@/lib/file-utils"
import { useFileDragAndDrop } from "@/hooks/use-file-drag-drop"
import { useSession } from "next-auth/react"
import { manageTags, deleteFiles, lookupByThumbnail, searchBySpecies, listAllFiles } from "@/lib/api"

type TagCountInput = {
  id: string
  tag: string
  count: number | ""
}

type SearchResult = {
  url: string
  fullUrl: string
  s3Url: string
  isOwner: boolean
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
  const [tagsOnly, setTagsOnly] = React.useState<string>("")

  // Tab 3
  const [thumbnailUrl, setThumbnailUrl] = React.useState<string>("")

  // Tab 4
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)

  // Search state
  const [searching, setSearching] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)
  const [results, setResults] = React.useState<SearchResult[] | null>(null)

  // Selection state
  const [selectedUrls, setSelectedUrls] = React.useState<Set<string>>(new Set())

  // View mode state
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("list")

  // Edit Tags modal state
  const [showEditModal, setShowEditModal] = React.useState(false)
  const [editTagsInput, setEditTagsInput] = React.useState("")
  const [editOperation, setEditOperation] = React.useState<1 | 0>(1)
  const [editLoading, setEditLoading] = React.useState(false)
  const [editResult, setEditResult] = React.useState<string | null>(null)

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = React.useState(false)
  const [deleteConfirmInput, setDeleteConfirmInput] = React.useState("")
  const [deleteLoading, setDeleteLoading] = React.useState(false)
  const [deleteResult, setDeleteResult] = React.useState<string | null>(null)

  // Portal mount state — ensures document.body is available
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => { setMounted(true) }, [])

  const anySelected = selectedUrls.size > 0
  const selectedCount = selectedUrls.size

  // Reset selections when results change
  React.useEffect(() => {
    setSelectedUrls(new Set())
  }, [results])

  // Load latest files on mount as default state
  React.useEffect(() => {
    const loadLatestFiles = async () => {
      const idToken = (session as any)?.idToken as string
      if (!idToken) return

      setSearching(true)
      setError(null)
      try {
        const data = await listAllFiles(idToken)
        const userEmail = session?.user?.email || ""
        const formattedResults = data.map((item) => ({
          url: item.thumbnail_url_http || item.file_url_http,
          fullUrl: item.file_url_http,
          s3Url: item.file_url,
          isOwner: item.user_id === userEmail,
        }))
        setResults(formattedResults)
      } catch (err: any) {
        console.error("Failed to load latest files:", err)
        setError(err.message || "Failed to load latest files.")
      } finally {
        setSearching(false)
      }
    }

    loadLatestFiles()
  }, [session])

  const toggleSelect = (url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev)
      if (next.has(url)) {
        next.delete(url)
      } else {
        next.add(url)
      }
      return next
    })
  }

  const selectAll = () => {
    if (!results) return
    setSelectedUrls(new Set(results.map((r) => r.s3Url)))
  }

  const clearSelection = () => setSelectedUrls(new Set())

  // ---- Search disabled logic ----
  const isSearchDisabled = React.useMemo(() => {
    if (activeTab === "tags-count") {
      return tagsCount.length === 0 || tagsCount.some(row => row.tag.trim() === "" || row.count === "")
    }
    if (activeTab === "tags-only") return tagsOnly.trim() === ""
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
  const searchTagsCount = async (tags: TagCountInput[]): Promise<SearchResult[]> => {
    console.log("Searching tags with minimum count:", tags)
    return new Promise((resolve) => setTimeout(() => resolve([
      {
        url: "https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?w=500&auto=format&fit=crop",
        fullUrl: "https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?w=500&auto=format&fit=crop",
        s3Url: "s3://mock-bucket/images/uuid-1/file1.jpg",
        isOwner: true
      },
      {
        url: "https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?w=500&auto=format&fit=crop",
        fullUrl: "https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?w=500&auto=format&fit=crop",
        s3Url: "s3://mock-bucket/images/uuid-2/file2.jpg",
        isOwner: true
      },
      {
        url: "https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=500&auto=format&fit=crop",
        fullUrl: "https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=500&auto=format&fit=crop",
        s3Url: "s3://mock-bucket/images/uuid-3/file3.jpg",
        isOwner: false
      },
    ]), 1000))
  }

  const searchTagsOnly = async (tagsString: string): Promise<SearchResult[]> => {
    const idToken = (session as any)?.idToken as string
    if (!idToken) {
      throw new Error("Not authenticated. Please log in again.")
    }
    const species = tagsString
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)

    if (species.length === 0) {
      throw new Error("Please enter at least one tag/species.")
    }

    const data = await searchBySpecies(idToken, species)
    const userEmail = session?.user?.email || ""
    return data.map((item) => ({
      url: item.thumbnail_url_http || item.file_url_http,
      fullUrl: item.file_url_http,
      s3Url: item.file_url,
      isOwner: item.user_id === userEmail,
    }))
  }

  const searchThumbnail = async (url: string): Promise<SearchResult[]> => {
    const idToken = (session as any)?.idToken as string
    if (!idToken) {
      throw new Error("Not authenticated. Please log in again.")
    }
    const data = await lookupByThumbnail(idToken, url)
    const userEmail = session?.user?.email || ""
    return [
      {
        url: data.thumbnail_url_http || data.file_url_http,
        fullUrl: data.file_url_http,
        s3Url: data.file_url,
        isOwner: data.user_id === userEmail,
      }
    ]
  }

  const searchFile = async (file: File | null): Promise<SearchResult[]> => {
    console.log("Searching by uploaded file:", file)
    return new Promise((resolve) => setTimeout(() => resolve([
      {
        url: "https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?w=500&auto=format&fit=crop",
        fullUrl: "https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?w=500&auto=format&fit=crop",
        s3Url: "s3://mock-bucket/images/uuid-1/file1.jpg",
        isOwner: true
      },
      {
        url: "https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?w=500&auto=format&fit=crop",
        fullUrl: "https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?w=500&auto=format&fit=crop",
        s3Url: "s3://mock-bucket/images/uuid-2/file2.jpg",
        isOwner: false
      },
    ]), 1000))
  }

  // ---- Search handler ----
  const handleSearch = async () => {
    setSearching(true)
    setError(null)
    setResults(null)

    try {
      let data: SearchResult[] = []

      if (activeTab === "tags-count") {
        const validTags = tagsCount
          .filter((t) => t.tag.trim() !== "")
          .map((t) => ({ ...t, count: t.count === "" ? 1 : Number(t.count) }))
        if (validTags.length === 0) throw new Error("Please specify at least one tag.")
        data = await searchTagsCount(validTags)
      } else if (activeTab === "tags-only") {
        if (!tagsOnly.trim()) throw new Error("Please input at least one tag/species.")
        data = await searchTagsOnly(tagsOnly)
      } else if (activeTab === "thumbnail") {
        if (!thumbnailUrl.trim()) throw new Error("Please input a thumbnail URL.")
        data = await searchThumbnail(thumbnailUrl)
      } else if (activeTab === "file") {
        if (!selectedFile) throw new Error("Please upload a file (image or video) to search.")
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

  // ---- Edit Tags handler ----
  const handleEditTags = async () => {
    setEditLoading(true)
    setEditResult(null)

    const idToken = (session as any)?.idToken as string
    if (!idToken) {
      setEditResult("Error: Not authenticated. Please log in again.")
      setEditLoading(false)
      return
    }

    const file_urls = Array.from(selectedUrls)
    const tags = editTagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)

    if (tags.length === 0) {
      setEditResult("Error: Please enter at least one tag.")
      setEditLoading(false)
      return
    }

    try {
      const data = await manageTags(idToken, { file_urls, tags, operation: editOperation })
      if (data.failed.length > 0) {
        const failedMsg = data.failed.map(f => `${f.url}: ${f.reason}`).join("; ")
        setEditResult(`Completed with errors. Updated: ${data.updated.length}, Failed: ${failedMsg}`)
      } else {
        setEditResult(`Successfully ${editOperation === 1 ? "added" : "removed"} tags on ${data.updated.length} file(s).`)
      }
    } catch (err: any) {
      setEditResult(`Error: ${err.message || "An unexpected error occurred."}`)
    } finally {
      setEditLoading(false)
    }
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setEditTagsInput("")
    setEditOperation(1)
    setEditResult(null)
  }

  // ---- Delete handler ----
  const handleDelete = async () => {
    setDeleteLoading(true)
    setDeleteResult(null)

    const idToken = (session as any)?.idToken as string
    if (!idToken) {
      setDeleteResult("Error: Not authenticated. Please log in again.")
      setDeleteLoading(false)
      return
    }

    const urls = Array.from(selectedUrls)

    try {
      const data = await deleteFiles(idToken, { urls })
      
      // Filter out successfully deleted files from the local results list
      const deletedSet = new Set(data.deleted)
      setResults((prev) => prev ? prev.filter((r) => !deletedSet.has(r.s3Url)) : prev)
      
      // Update selectedUrls to clear successfully deleted items
      setSelectedUrls((prev) => {
        const next = new Set(prev)
        data.deleted.forEach(url => next.delete(url))
        return next
      })

      if (data.failed.length > 0) {
        const failedMsg = data.failed.map(f => `${f.url}: ${f.reason}`).join("; ")
        setDeleteResult(`Completed with errors. Deleted: ${data.deleted.length}, Failed: ${failedMsg}`)
      } else {
        setDeleteResult(`Successfully deleted ${data.deleted.length} file(s).`)
      }
    } catch (err: any) {
      setDeleteResult(`Error: ${err.message || "An unexpected error occurred."}`)
    } finally {
      setDeleteLoading(false)
    }
  }

  const closeDeleteModal = () => {
    setShowDeleteModal(false)
    setDeleteConfirmInput("")
    setDeleteResult(null)
  }

  // ---- Modals ----
  const editModal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeEditModal} />
      <div className="relative bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Edit Tags</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {selectedCount} file{selectedCount !== 1 ? "s" : ""} selected
            </p>
          </div>
          <button onClick={closeEditModal} className="text-muted-foreground hover:text-foreground transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Operation</label>
          <div className="flex gap-3">
            <Button
              variant={editOperation === 1 ? "default" : "outline"}
              className="flex-1"
              onClick={() => {
                setEditOperation(1)
                if (editResult) { setEditResult(null); setEditTagsInput("") }
              }}
            >
              Add Tags
            </Button>
            <Button
              variant={editOperation === 0 ? "destructive" : "outline"}
              className="flex-1"
              onClick={() => {
                setEditOperation(0)
                if (editResult) { setEditResult(null); setEditTagsInput("") }
              }}
            >
              Remove Tags
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Tags</label>
          <Input
            placeholder="e.g. koala, dingo, wombat"
            value={editTagsInput}
            onChange={(e) => setEditTagsInput(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Comma-separated list of tags.</p>
        </div>
        {editResult ? (
          <>
            <div className="text-sm text-primary bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
              {editResult}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => {
                  setEditResult(null)
                  setEditTagsInput("")
                }}
              >
                Continue
              </Button>
              <Button onClick={closeEditModal} className="upload-action-button">
                Done
              </Button>
            </div>
          </>
        ) : (
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={closeEditModal}>Cancel</Button>
            <Button
              onClick={handleEditTags}
              disabled={!editTagsInput.trim() || editLoading}
              className="upload-action-button"
            >
              {editLoading && (
                <svg className="upload-spinner" fill="none" viewBox="0 0 24 24">
                  <circle className="upload-spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="upload-spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {editLoading ? "Applying..." : editOperation === 1 ? "Add Tags" : "Remove Tags"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )

  const deleteModal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeDeleteModal} />
      <div className="relative bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-destructive">Delete Files</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {selectedCount} file{selectedCount !== 1 ? "s" : ""} selected
            </p>
          </div>
          <button onClick={closeDeleteModal} className="text-muted-foreground hover:text-foreground transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 flex flex-col gap-1">
          <p className="text-sm font-semibold text-destructive">This action cannot be undone.</p>
          <p className="text-sm text-muted-foreground">
            The selected files and their thumbnails will be permanently removed from storage and the database.
            You can only delete files you have uploaded.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">
            Type <span className="font-mono font-bold">confirm</span> to proceed
          </label>
          <Input
            placeholder="confirm"
            value={deleteConfirmInput}
            onChange={(e) => setDeleteConfirmInput(e.target.value)}
          />
        </div>
        {deleteResult && (
          <div className="text-sm text-primary bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
            {deleteResult}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={closeDeleteModal}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteConfirmInput !== "confirm" || deleteLoading}
            className="upload-action-button"
          >
            {deleteLoading && (
              <svg className="upload-spinner" fill="none" viewBox="0 0 24 24">
                <circle className="upload-spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="upload-spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {deleteLoading ? "Deleting..." : "Delete Files"}
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <>
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
                      <Input
                        placeholder="Tag name (e.g. kangaroo)"
                        value={row.tag}
                        onChange={(e) =>
                          updateTagRow(row.id, "tag", e.target.value)
                        }
                        className="flex-1"
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
                        className="w-24"
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

            {/* Tab 3 */}
            <TabsContent value="thumbnail" className="space-y-4">
              <div className="search-input-group">
                <span className="text-sm font-medium">Thumbnail URL</span>
                <Input
                  placeholder="s3://aussie-ecolens-s3-media/thumbnails/thumbnail.png"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the exact S3 URI of the thumbnail to find the original full-sized file.
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

          {/* Skeleton */}
          {searching && (
            <div className="search-results-grid">
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
          )}

          {/* Results */}
          {results && results.length > 0 && (
            <div className="mt-6 space-y-3 border-t pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold">Search Results</h3>
                  {anySelected && (
                    <span className="text-xs text-muted-foreground">
                      {selectedCount} selected
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* View mode toggle */}
                  <div className="flex items-center rounded-md border border-border overflow-hidden">
                    <button
                      onClick={() => setViewMode("list")}
                      title="List view"
                      className={`flex h-9 w-9 items-center justify-center transition-colors ${
                        viewMode === "list"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setViewMode("grid")}
                      title="Icons view"
                      className={`flex h-9 w-9 items-center justify-center transition-colors ${
                        viewMode === "grid"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" rx="1" />
                        <rect x="14" y="3" width="7" height="7" rx="1" />
                        <rect x="3" y="14" width="7" height="7" rx="1" />
                        <rect x="14" y="14" width="7" height="7" rx="1" />
                      </svg>
                    </button>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!anySelected}
                    onClick={() => {
                      setShowEditModal(true)
                      setEditResult(null)
                    }}
                    className="flex h-8 items-center gap-1.5"
                  >
                    <HugeiconsIcon
                      icon={Tag01Icon}
                      className="size-3.5"
                      strokeWidth={2}
                    />
                    Edit Tags
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!anySelected}
                    onClick={() => {
                      setShowDeleteModal(true)
                      setDeleteResult(null)
                    }}
                    className="flex h-8 items-center gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 disabled:border-border disabled:text-muted-foreground"
                  >
                    <HugeiconsIcon
                      icon={Delete02Icon}
                      className="size-3.5"
                      strokeWidth={2}
                    />
                    Delete Files
                  </Button>
                </div>
              </div>

              {viewMode === "grid" ? (
                <>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={anySelected ? clearSelection : selectAll}
                      className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {anySelected ? "Clear selection" : "Select all"}
                    </button>
                  </div>
                  <div className="search-results-grid">
                  {results.map((result, index) => {
                    const isVideo =
                      result.s3Url.toLowerCase().endsWith(".mp4") ||
                      result.s3Url.toLowerCase().endsWith(".mov") ||
                      result.s3Url.toLowerCase().endsWith(".avi")
                    const isSelected = selectedUrls.has(result.s3Url)

                    return (
                      <div
                        key={index}
                        className={`search-result-card group cursor-pointer select-none ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}
                        onClick={() => toggleSelect(result.s3Url)}
                      >
                        <div
                          className={`absolute top-2 left-2 z-10 flex h-5 w-5 items-center justify-center rounded border-2 transition-all bg-white ${
                            isSelected
                              ? "border-primary opacity-100"
                              : "border-primary opacity-0 group-hover:opacity-100"
                          }`}
                        >
                          <div className={`absolute inset-0 rounded bg-primary/15 transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} />
                          {isSelected && (
                            <svg
                              className="relative z-10 h-3 w-3 text-primary"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth="3"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                        {!result.isOwner && (
                          <div className="absolute top-2 right-2 z-10 rounded bg-black/50 px-1.5 py-0.5 text-xs text-white">
                            Not yours
                          </div>
                        )}
                        {isVideo ? (
                          <video
                            src={result.url}
                            controls
                            className="search-result-video"
                          />
                        ) : (
                          <img
                            src={result.url}
                            alt={`Result ${index + 1}`}
                            className="search-result-image"
                          />
                        )}
                        <div className="search-result-overlay">
                          <a
                            href={result.fullUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="search-result-link"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View Full File
                          </a>
                        </div>
                      </div>
                    )
                  })}
                </div>
                </>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <div
                          onClick={anySelected ? clearSelection : selectAll}
                          className={`relative flex h-5 w-5 cursor-pointer items-center justify-center rounded border-2 transition-colors bg-white ${
                            anySelected ? "border-primary" : "border-border hover:border-primary"
                          }`}
                        >
                          {anySelected && <div className="absolute inset-0 rounded bg-primary/15" />}
                          {anySelected && (
                            <svg className="relative z-10 h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="w-16">Thumbnail</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Owner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result, index) => {
                      const isVideo =
                        result.s3Url.toLowerCase().endsWith(".mp4") ||
                        result.s3Url.toLowerCase().endsWith(".mov") ||
                        result.s3Url.toLowerCase().endsWith(".avi")
                      const isSelected = selectedUrls.has(result.s3Url)

                      return (
                        <TableRow
                          key={index}
                          className={`cursor-pointer select-none transition-colors ${
                            isSelected
                              ? "bg-primary/5 hover:bg-primary/10"
                              : index % 2 === 0
                                ? "bg-background hover:bg-muted/50"
                                : "bg-muted/20 hover:bg-muted/50"
                          }`}
                          onClick={() => toggleSelect(result.s3Url)}
                        >
                          <TableCell>
                            <div
                              className={`relative flex h-5 w-5 items-center justify-center rounded border-2 transition-colors bg-white ${
                                isSelected ? "border-primary" : "border-border"
                              }`}
                            >
                              {isSelected && <div className="absolute inset-0 rounded bg-primary/15" />}
                              {isSelected && (
                                <svg className="relative z-10 h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="h-12 w-12 overflow-hidden rounded-lg bg-muted">
                              {isVideo ? (
                                <video src={result.url} className="h-full w-full object-cover" />
                              ) : (
                                <img src={result.url} alt={`Result ${index + 1}`} className="h-full w-full object-cover" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <a
                              href={result.fullUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate block text-xs text-black underline-offset-2 hover:underline max-w-xs"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {result.s3Url}
                            </a>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">—</span>
                          </TableCell>
                          <TableCell>
                            {result.isOwner
                              ? <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{(session?.user?.name ?? session?.user?.email) || "You"}</span>
                              : <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Other user</span>
                            }
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {results && results.length === 0 && (
            <div className="mt-6 border-t pt-6">
              <div className="search-no-results">
                <p className="text-muted-foreground">
                  No matching files found.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Portals — rendered directly into document.body */}
      {mounted && showEditModal && createPortal(editModal, document.body)}
      {mounted && showDeleteModal && createPortal(deleteModal, document.body)}
    </>
  )
}