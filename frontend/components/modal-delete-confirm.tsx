"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDeleteFiles } from "@/hooks/use-delete-files"
import { type FileResult } from "@/lib/file-results"

type DeleteConfirmModalProps = {
  isOpen: boolean
  onClose: () => void
  selectedUrls: Set<string>
  results: FileResult[] | null
  setSelectedUrls: React.Dispatch<React.SetStateAction<Set<string>>>
  onAfterDelete?: (deletedCount: number) => void | Promise<void>
  onResultsChange?: React.Dispatch<React.SetStateAction<FileResult[] | null>>
}

export function ModalDeleteConfirm({
  isOpen,
  onClose,
  selectedUrls,
  results,
  setSelectedUrls,
  onAfterDelete,
  onResultsChange,
}: DeleteConfirmModalProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const {
    deleteConfirmInput,
    setDeleteConfirmInput,
    deleteLoading,
    deleteResult,
    closeDeleteModal,
    handleDelete,
  } = useDeleteFiles({
    selectedUrls,
    results,
    setSelectedUrls,
    onAfterDelete,
    onResultsChange,
    onClose,
  })

  const selectedCount = selectedUrls.size


  if (!isOpen || !mounted) return null

  return createPortal(
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
    </div>,
    document.body
  )
}
