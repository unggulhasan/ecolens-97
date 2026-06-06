import * as React from "react"
import { useSession } from "next-auth/react"
import { manageTags } from "@/lib/api"
import { applyTagUpdates, type TagUpdate, type FileResult } from "@/lib/file-results"

export type TagEditItem = {
  name: string
  count: number
}

type UseEditTagsProps = {
  selectedUrls: Set<string>
  onAfterTagsUpdate?: (updates: TagUpdate[]) => void
  onResultsChange?: React.Dispatch<React.SetStateAction<FileResult[] | null>>
  onClose: () => void
}

export function useEditTags({
  selectedUrls,
  onAfterTagsUpdate,
  onResultsChange,
  onClose,
}: UseEditTagsProps) {
  const { data: session } = useSession()

  const [editTags, setEditTags] = React.useState<TagEditItem[]>([
    { name: "", count: 1 },
  ])
  const [editOperation, setEditOperation] = React.useState<1 | 0>(1)
  const [editLoading, setEditLoading] = React.useState(false)
  const [editResult, setEditResult] = React.useState<string | null>(null)

  const closeEditModal = React.useCallback(() => {
    setEditTags([{ name: "", count: 1 }])
    setEditOperation(1)
    setEditResult(null)
    onClose()
  }, [onClose])

  const continueEditingTags = React.useCallback(() => {
    setEditResult(null)
    setEditTags([{ name: "", count: 1 }])
  }, [])

  const addTagRow = React.useCallback(() => {
    setEditTags((prev) => [...prev, { name: "", count: 1 }])
  }, [])

  const removeTagRow = React.useCallback((index: number) => {
    setEditTags((prev) => prev.filter((_, idx) => idx !== index))
  }, [])

  const updateTagRow = React.useCallback(
    (index: number, updates: Partial<TagEditItem>) => {
      setEditTags((prev) =>
        prev.map((item, idx) =>
          idx === index ? { ...item, ...updates } : item
        )
      )
    },
    []
  )

  const handleEditTags = React.useCallback(async () => {
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
      const data = await manageTags(idToken, {
        file_urls,
        tags,
        operation: editOperation,
      })

      if (data.updated.length > 0) {
        if (onAfterTagsUpdate) {
          onAfterTagsUpdate(data.updated)
        } else if (onResultsChange) {
          onResultsChange((prev) => applyTagUpdates(prev, data.updated))
        }
      }

      if (data.failed.length > 0) {
        const failedMsg = data.failed
          .map((f) => `${f.url}: ${f.reason}`)
          .join("; ")
        setEditResult(
          `Completed with errors. Updated: ${data.updated.length}, Failed: ${failedMsg}`
        )
      } else {
        setEditResult(
          `Successfully ${
            editOperation === 1 ? "added" : "removed"
          } tags on ${data.updated.length} file(s).`
        )
      }
    } catch (err: any) {
      setEditResult(
        `Error: ${err.message || "An unexpected error occurred."}`
      )
    } finally {
      setEditLoading(false)
    }
  }, [
    session,
    selectedUrls,
    editTags,
    editOperation,
    onAfterTagsUpdate,
    onResultsChange,
  ])

  return {
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
  }
}
