"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AutocompleteInput } from "@/components/ui/autocomplete-input"
import { WILDLIFE_SUGGESTIONS } from "@/lib/constants"
import { useEditTags } from "@/hooks/use-edit-tags"
import { type TagUpdate, type FileResult } from "@/lib/file-results"

type EditTagsModalProps = {
  isOpen: boolean
  onClose: () => void
  selectedUrls: Set<string>
  onAfterTagsUpdate?: (updates: TagUpdate[]) => void
  onResultsChange?: React.Dispatch<React.SetStateAction<FileResult[] | null>>
}

export function ModalEditTags({
  isOpen,
  onClose,
  selectedUrls,
  onAfterTagsUpdate,
  onResultsChange,
}: EditTagsModalProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const {
    editTags,
    editOperation,
    setEditOperation,
    editLoading,
    editResult,
    setEditResult,
    closeEditModal,
    continueEditingTags,
    addTagRow,
    removeTagRow,
    updateTagRow,
    handleEditTags,
  } = useEditTags({
    selectedUrls,
    onAfterTagsUpdate,
    onResultsChange,
    onClose,
  })

  const selectedCount = selectedUrls.size

  if (!isOpen || !mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeEditModal}
      />
      <div className="relative flex w-full max-w-md flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Edit Tags</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {selectedCount} file{selectedCount !== 1 ? "s" : ""} selected
            </p>
          </div>
          <button
            onClick={closeEditModal}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <svg
              className="h-5 w-5"
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
                  continueEditingTags()
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
                  continueEditingTags()
                }
              }}
            >
              Remove Tags
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Tags</label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addTagRow}
              className="h-8 rounded-full border-border px-2.5 text-xs hover:bg-accent"
            >
              + Add Tag
            </Button>
          </div>

          <div className="flex flex-col gap-2.5">
            {editTags.map((tagItem, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="flex-1">
                  <AutocompleteInput
                    suggestions={WILDLIFE_SUGGESTIONS}
                    placeholder="Tag name (e.g. wombat)"
                    value={tagItem.name}
                    onChange={(e) =>
                      updateTagRow(idx, { name: e.target.value })
                    }
                    onSelectSuggestion={(val) =>
                      updateTagRow(idx, { name: val })
                    }
                    className="w-full rounded-full border border-input bg-white dark:bg-slate-950"
                  />
                </div>
                {editOperation === 1 && (
                  <Input
                    type="number"
                    min="1"
                    className="w-24 rounded-full border border-input bg-white dark:bg-slate-950"
                    placeholder="Count"
                    value={tagItem.count}
                    onChange={(e) =>
                      updateTagRow(idx, {
                        count: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                )}
                {editTags.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTagRow(idx)}
                    className="shrink-0 p-1.5 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <svg
                      className="h-4 w-4"
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
                )}
              </div>
            ))}
          </div>
        </div>

        {editResult?.startsWith("Successfully") ? (
          <>
            <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
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
            <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
              {editResult}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={closeEditModal}>
                Cancel
              </Button>
              <Button
                onClick={handleEditTags}
                disabled={
                  !editTags.some((t) => t.name.trim() !== "") || editLoading
                }
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
              disabled={
                !editTags.some((t) => t.name.trim() !== "") || editLoading
              }
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
    </div>,
    document.body
  )
}
