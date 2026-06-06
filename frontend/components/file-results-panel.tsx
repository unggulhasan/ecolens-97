"use client"

import * as React from "react"
import { SearchResultsPagination } from "@/components/search-results-pagination"
import { ModalEditTags } from "@/components/modal-edit-tags"
import { ModalDeleteConfirm } from "@/components/modal-delete-confirm"
import { FileResultsSkeleton } from "@/components/file-results-skeleton"
import { FileResultsToolbar } from "@/components/file-results-toolbar"
import { FileResultsGrid } from "@/components/file-results-grid"
import { FileResultsList } from "@/components/file-results-list"
import { useFileSelection } from "@/hooks/use-file-selection"
import {
  type FileResult,
  type PaginationMeta,
  type TagUpdate,
} from "@/lib/file-results"

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
  const {
    selectedUrls,
    setSelectedUrls,
    toggleSelect,
    selectAll,
    clearSelection,
    anySelected,
    selectedCount,
    othersInSelection,
    canDelete,
  } = useFileSelection(results)

  const [viewMode, setViewMode] = React.useState<"grid" | "list">("list")
  const [showEditModal, setShowEditModal] = React.useState(false)
  const [showDeleteModal, setShowDeleteModal] = React.useState(false)

  const defaultEmptyMessage = pagination
    ? "No files on this page."
    : "No matching files found."

  return (
    <>
      {loading && (
        <FileResultsSkeleton title={title} statusLabel={statusLabel} />
      )}

      {results && results.length > 0 && (
        <div className="space-y-3">
          <FileResultsToolbar
            title={title}
            statusLabel={statusLabel}
            anySelected={anySelected}
            selectedCount={selectedCount}
            othersInSelection={othersInSelection}
            canDelete={canDelete}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onEditTags={() => setShowEditModal(true)}
            onDeleteFiles={() => setShowDeleteModal(true)}
          />

          {viewMode === "grid" ? (
            <FileResultsGrid
              results={results}
              selectedUrls={selectedUrls}
              onToggleSelect={toggleSelect}
              onClearSelection={clearSelection}
              onSelectAll={selectAll}
            />
          ) : (
            <FileResultsList
              results={results}
              selectedUrls={selectedUrls}
              onToggleSelect={toggleSelect}
              onClearSelection={clearSelection}
              onSelectAll={selectAll}
            />
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

      <ModalEditTags
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        selectedUrls={selectedUrls}
        onAfterTagsUpdate={onAfterTagsUpdate}
        onResultsChange={onResultsChange}
      />
      <ModalDeleteConfirm
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        selectedUrls={selectedUrls}
        results={results}
        setSelectedUrls={setSelectedUrls}
        onAfterDelete={onAfterDelete}
        onResultsChange={onResultsChange}
      />
    </>
  )
}
