import * as React from "react"
import {
  type FileResult,
  countOthersInSelection,
  canDeleteSelection,
} from "@/lib/file-results"

export function useFileSelection(results: FileResult[] | null) {
  const [selectedUrls, setSelectedUrls] = React.useState<Set<string>>(new Set())

  // Generate a key based on the list of file S3 URLs to reset selection when pages/search results change
  const resultFileKeys = React.useMemo(
    () => (results ?? []).map((r) => r.s3Url).join("\n"),
    [results]
  )

  React.useEffect(() => {
    setSelectedUrls(new Set())
  }, [resultFileKeys])

  const toggleSelect = React.useCallback((url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev)
      if (next.has(url)) {
        next.delete(url)
      } else {
        next.add(url)
      }
      return next
    })
  }, [])

  const selectAll = React.useCallback(() => {
    if (!results) return
    setSelectedUrls(new Set(results.map((r) => r.s3Url)))
  }, [results])

  const clearSelection = React.useCallback(() => {
    setSelectedUrls(new Set())
  }, [])

  const anySelected = selectedUrls.size > 0
  const selectedCount = selectedUrls.size

  const othersInSelection = React.useMemo(
    () => countOthersInSelection(results, selectedUrls),
    [results, selectedUrls]
  )

  const canDelete = React.useMemo(
    () => canDeleteSelection(results, selectedUrls),
    [results, selectedUrls]
  )

  return {
    selectedUrls,
    setSelectedUrls,
    toggleSelect,
    selectAll,
    clearSelection,
    anySelected,
    selectedCount,
    othersInSelection,
    canDelete,
  }
}
