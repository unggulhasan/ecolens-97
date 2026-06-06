"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon, Tag01Icon } from "@hugeicons/core-free-icons"
import { useSession } from "next-auth/react"
import { manageTags, deleteFiles } from "@/lib/api"
import { SearchResultsPagination } from "@/components/search-results-pagination"
import { AutocompleteInput } from "@/components/ui/autocomplete-input"
import { WILDLIFE_SUGGESTIONS } from "@/lib/constants"
import {
  type FileResult,
  type PaginationMeta,
  type TagUpdate,
  applyTagUpdates,
  canDeleteSelection,
  countOthersInSelection,
  isVideoFile,
} from "@/lib/file-results"

type TagEditItem = {
  name: string
  count: number
}

type FileResultsPanelProps = {
  title: string
  statusLabel?: string
  results: FileResult[] | null
  loading: boolean
  pagination?: PaginationMeta | null
  onPageChange?: (page: number) => void
  onResultsChange?: React.Dispatch<React.SetStateAction<FileResult[] | null>>
  onAfterDelete?: (deletedCount: number) => void | Promise<void>
  onAfterTagsUpdate?: (updates: TagUpdate[]) => void
  emptyMessage?: string
}

export function FileResultsPanel({
  title,
  statusLabel,
  results,
  loading,
  pagination,
  onPageChange,
  onResultsChange,
  onAfterDelete,
  onAfterTagsUpdate,
  emptyMessage,
}: FileResultsPanelProps) {
  const { data: session } = useSession()

  const [selectedUrls, setSelectedUrls] = React.useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("list")

  const [showEditModal, setShowEditModal] = React.useState(false)
  const [editTags, setEditTags] = React.useState<TagEditItem[]>([{ name: "", count: 1 }])
  const [editOperation, setEditOperation] = React.useState<1 | 0>(1)
  const [editLoading, setEditLoading] = React.useState(false)
  const [editResult, setEditResult] = React.useState<string | null>(null)

  const [showDeleteModal, setShowDeleteModal] = React.useState(false)
  const [deleteConfirmInput, setDeleteConfirmInput] = React.useState("")
  const [deleteLoading, setDeleteLoading] = React.useState(false)
  const [deleteResult, setDeleteResult] = React.useState<string | null>(null)

  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const anySelected = selectedUrls.size > 0
  const selectedCount = selectedUrls.size
  const othersInSelection = countOthersInSelection(results, selectedUrls)
  const canDelete = canDeleteSelection(results, selectedUrls)

  const resultFileKeys = React.useMemo(
    () => (results ?? []).map((r) => r.s3Url).join("\n"),
    [results]
  )

  React.useEffect(() => {
    setSelectedUrls(new Set())
  }, [resultFileKeys])

  const continueEditingTags = React.useCallback(() => {
    setEditResult(null)
    setEditTags([{ name: "", count: 1 }])
  }, [])

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
    const tags = editTags
      .map((t) => {
        const name = t.name.trim().toLowerCase()
        if (!name) return null
        return editOperation === 1 ? `${name}:${t.count}` : name
      })
      .filter((t): t is string => t !== null)

    if (tags.length === 0) {
      setEditResult("Error: Please enter at least one valid tag name.")
      setEditLoading(false)
      return
    }

    try {
      const data = await manageTags(idToken, { file_urls, tags, operation: editOperation })

      if (data.updated.length > 0) {
        if (onAfterTagsUpdate) {
          onAfterTagsUpdate(data.updated)
        } else if (onResultsChange) {
          onResultsChange((prev) => applyTagUpdates(prev, data.updated))
        }
      }

      if (data.failed.length > 0) {
        const failedMsg = data.failed.map((f) => `${f.url}: ${f.reason}`).join("; ")
        setEditResult(
          `Completed with errors. Updated: ${data.updated.length}, Failed: ${failedMsg}`
        )
      } else {
        setEditResult(
          `Successfully ${editOperation === 1 ? "added" : "removed"} tags on ${data.updated.length} file(s).`
        )
      }
    } catch (err: any) {
      setEditResult(`Error: ${err.message || "An unexpected error occurred."}`)
    } finally {
      setEditLoading(false)
    }
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setEditTags([{ name: "", count: 1 }])
    setEditOperation(1)
    setEditResult(null)
  }

  const addTagRow = () => {
    setEditTags((prev) => [...prev, { name: "", count: 1 }])
  }

  const removeTagRow = (index: number) => {
    setEditTags((prev) => prev.filter((_, idx) => idx !== index))
  }

  const updateTagRow = (index: number, updates: Partial<TagEditItem>) => {
    setEditTags((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...updates } : item))
    )
  }

  const handleDelete = async () => {
    setDeleteLoading(true)
    setDeleteResult(null)

    const idToken = (session as any)?.idToken as string
    if (!idToken) {
      setDeleteResult("Error: Not authenticated. Please log in again.")
      setDeleteLoading(false)
      return
    }

    const urls = Array.from(selectedUrls).filter(
      (url) => results?.find((r) => r.s3Url === url)?.isOwner
    )

    try {
      const data = await deleteFiles(idToken, { urls })

      setSelectedUrls((prev) => {
        const next = new Set(prev)
        data.deleted.forEach((url) => next.delete(url))
        return next
      })

      if (onAfterDelete) {
        await onAfterDelete(data.deleted.length)
      } else if (onResultsChange) {
        const deletedSet = new Set(data.deleted)
        onResultsChange((prev) =>
          prev ? prev.filter((r) => !deletedSet.has(r.s3Url)) : prev
        )
      }

      if (data.failed.length > 0) {
        const failedMsg = data.failed.map((f) => `${f.url}: ${f.reason}`).join("; ")
        setDeleteResult(
          `Completed with errors. Deleted: ${data.deleted.length}, Failed: ${failedMsg}`
        )
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

  const defaultEmptyMessage = pagination
    ? "No files on this page."
    : "No matching files found."

  const editModal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeEditModal}
      />
      <div className="relative bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Edit Tags</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {selectedCount} file{selectedCount !== 1 ? "s" : ""} selected
            </p>
          </div>
          <button
            onClick={closeEditModal}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
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
                if (editResult) {
                  setEditResult(null)
                  setEditTags([{ name: "", count: 1 }])
                }
              }}
            >
              Add Tags
            </Button>
            <Button
              variant={editOperation === 0 ? "destructive" : "outline"}
              className="flex-1"
              onClick={() => {
                setEditOperation(0)
                if (editResult) {
                  setEditResult(null)
                  setEditTags([{ name: "", count: 1 }])
                }
              }}
            >
              Remove Tags
            </Button>
          </div>
        </div>
        
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium">Tags</label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addTagRow}
              className="h-8 px-2.5 text-xs rounded-full border-border hover:bg-accent"
            >
              + Add Tag
            </Button>
          </div>

          <div className="flex flex-col gap-2.5">
            {editTags.map((tagItem, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <div className="flex-1">
                  <AutocompleteInput
                    suggestions={WILDLIFE_SUGGESTIONS}
                    placeholder="e.g. koala"
                    value={tagItem.name}
                    onChange={(e) => updateTagRow(idx, { name: e.target.value })}
                    onSelectSuggestion={(val) => updateTagRow(idx, { name: val })}
                    className="w-full bg-white dark:bg-slate-950 rounded-full border border-input"
                  />
                </div>
                {editOperation === 1 && (
                  <Input
                    type="number"
                    min="1"
                    className="w-24 bg-white dark:bg-slate-950 rounded-full border border-input"
                    placeholder="Count"
                    value={tagItem.count}
                    onChange={(e) => updateTagRow(idx, { count: parseInt(e.target.value) || 1 })}
                  />
                )}
                {editTags.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTagRow(idx)}
                    className="text-muted-foreground hover:text-destructive p-1.5 transition-colors shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {editResult?.startsWith("Successfully") ? (
          <>
            <div className="text-sm text-primary bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
              {editResult}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={continueEditingTags}>
                Continue
              </Button>
              <Button onClick={closeEditModal} className="upload-action-button">
                Done
              </Button>
            </div>
          </>
        ) : editResult ? (
          <>
            <div className="text-sm text-primary bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
              {editResult}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={closeEditModal}>
                Cancel
              </Button>
              <Button
                onClick={handleEditTags}
                disabled={!editTags.some((t) => t.name.trim() !== "") || editLoading}
                className="upload-action-button"
              >
                {editLoading ? "Applying..." : "Try Again"}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={closeEditModal}>
              Cancel
            </Button>
            <Button
              onClick={handleEditTags}
              disabled={!editTags.some((t) => t.name.trim() !== "") || editLoading}
              className="upload-action-button"
            >
              {editLoading && (
                <svg className="upload-spinner" fill="none" viewBox="0 0 24 24">
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
              {editLoading
                ? "Applying..."
                : editOperation === 1
                  ? "Add Tags"
                  : "Remove Tags"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )

  const deleteModal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeDeleteModal}
      />
      <div className="relative bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-destructive">Delete Files</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {selectedCount} file{selectedCount !== 1 ? "s" : ""} selected
            </p>
          </div>
          <button
            onClick={closeDeleteModal}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        {deleteResult?.startsWith("Successfully") ? (
          <>
            <div className="text-sm text-primary bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
              {deleteResult}
            </div>
            <div className="flex justify-end pt-1">
              <Button onClick={closeDeleteModal} className="upload-action-button">
                Done
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 flex flex-col gap-1">
              <p className="text-sm font-semibold text-destructive">
                This action cannot be undone.
              </p>
              <p className="text-sm text-muted-foreground">
                The selected files and their thumbnails will be permanently removed from storage
                and the database. You can only delete files you have uploaded.
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
              <Button variant="outline" onClick={closeDeleteModal}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteConfirmInput !== "confirm" || deleteLoading}
                className="upload-action-button"
              >
                {deleteLoading && (
                  <svg className="upload-spinner" fill="none" viewBox="0 0 24 24">
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
                {deleteLoading ? "Deleting..." : "Delete Files"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )

  return (
    <>
      {loading && (
        <div className="search-results-list">
          <div className="search-results-list-header">
            <h3 className="search-results-list-title">{title}</h3>
            <span className="search-results-list-status">
              {statusLabel ?? "Loading..."}
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="w-16">Thumbnail</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Owner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }, (_, i) => (
                <TableRow key={i} className="search-results-list-skeleton-row">
                  <TableCell>
                    <Skeleton className="size-5 rounded" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="size-12 rounded-lg" />
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <Skeleton className="h-3 w-full max-w-xs" />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Skeleton className="h-5 w-14 rounded-full" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {results && results.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold">{title}</h3>
              {statusLabel && (
                <span className="text-xs text-muted-foreground">{statusLabel}</span>
              )}
              {anySelected && (
                <span className="text-xs text-muted-foreground">
                  {selectedCount} selected
                  {othersInSelection > 0 &&
                    ` (${othersInSelection} not yours - delete disabled)`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
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
                  <svg
                    className="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
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
                  <svg
                    className="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
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
                <HugeiconsIcon icon={Tag01Icon} className="size-3.5" strokeWidth={2} />
                Edit Tags
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!anySelected || !canDelete}
                title={
                  othersInSelection > 0
                    ? "Deselect other users' files to delete"
                    : undefined
                }
                onClick={() => {
                  setShowDeleteModal(true)
                  setDeleteResult(null)
                }}
                className="flex h-8 items-center gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 disabled:border-border disabled:text-muted-foreground"
              >
                <HugeiconsIcon icon={Delete02Icon} className="size-3.5" strokeWidth={2} />
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
                  const isVideo = isVideoFile(result.s3Url)
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
                        <div
                          className={`absolute inset-0 rounded bg-primary/15 transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                        />
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
                        <video src={result.url} controls className="search-result-video" />
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
                        anySelected
                          ? "border-primary"
                          : "border-border hover:border-primary"
                      }`}
                    >
                      {anySelected && (
                        <div className="absolute inset-0 rounded bg-primary/15" />
                      )}
                      {anySelected && (
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
                  </TableHead>
                  <TableHead className="w-16">Thumbnail</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Owner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result, index) => {
                  const isVideo = isVideoFile(result.s3Url)
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
                          {isSelected && (
                            <div className="absolute inset-0 rounded bg-primary/15" />
                          )}
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
                      </TableCell>
                      <TableCell>
                        <div className="h-12 w-12 overflow-hidden rounded-lg bg-muted">
                          {isVideo ? (
                            <video
                              src={result.url}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <img
                              src={result.url}
                              alt={`Result ${index + 1}`}
                              className="h-full w-full object-cover"
                            />
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
                        {Object.keys(result.tags).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {Object.keys(result.tags).map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary uppercase tracking-wider"
                              >
                                {tag} ({result.tags[tag]})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            -
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {result.isOwner ? (
                          <div className="flex flex-col">
                            <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary mb-0.5">
                              You
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {result.userId}
                            </span>
                          </div>
                        ) : (
                          <span
                            className="text-xs text-muted-foreground"
                            title={result.userId}
                          >
                            {result.userId || "Other user"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}

          {pagination && onPageChange && (
            <SearchResultsPagination
              page={pagination.page}
              pageSize={pagination.pageSize}
              total={pagination.total}
              loading={loading}
              onPageChange={onPageChange}
            />
          )}
        </div>
      )}

      {results && results.length === 0 && !loading && (
        <div>
          <div className="search-no-results">
            <p className="text-muted-foreground">
              {emptyMessage ?? defaultEmptyMessage}
            </p>
          </div>
          {pagination && onPageChange && (
            <SearchResultsPagination
              page={pagination.page}
              pageSize={pagination.pageSize}
              total={pagination.total}
              loading={loading}
              onPageChange={onPageChange}
            />
          )}
        </div>
      )}

      {mounted && showEditModal && createPortal(editModal, document.body)}
      {mounted && showDeleteModal && createPortal(deleteModal, document.body)}
    </>
  )
}
