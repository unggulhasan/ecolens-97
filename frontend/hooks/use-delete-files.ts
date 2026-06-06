import * as React from "react"
import { useSession } from "next-auth/react"
import { deleteFiles } from "@/lib/api"
import { type FileResult } from "@/lib/file-results"

type UseDeleteFilesProps = {
  selectedUrls: Set<string>
  results: FileResult[] | null
  setSelectedUrls: React.Dispatch<React.SetStateAction<Set<string>>>
  onAfterDelete?: (deletedCount: number) => void | Promise<void>
  onResultsChange?: React.Dispatch<React.SetStateAction<FileResult[] | null>>
  onClose: () => void
}

export function useDeleteFiles({
  selectedUrls,
  results,
  setSelectedUrls,
  onAfterDelete,
  onResultsChange,
  onClose,
}: UseDeleteFilesProps) {
  const { data: session } = useSession()

  const [deleteConfirmInput, setDeleteConfirmInput] = React.useState("")
  const [deleteLoading, setDeleteLoading] = React.useState(false)
  const [deleteResult, setDeleteResult] = React.useState<string | null>(null)

  const closeDeleteModal = React.useCallback(() => {
    setDeleteConfirmInput("")
    setDeleteResult(null)
    onClose()
  }, [onClose])

  const handleDelete = React.useCallback(async () => {
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

      // Clear the successfully deleted URLs from the current selected set
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
        const failedMsg = data.failed
          .map((f) => `${f.url}: ${f.reason}`)
          .join("; ")
        setDeleteResult(
          `Completed with errors. Deleted: ${data.deleted.length}, Failed: ${failedMsg}`
        )
      } else {
        setDeleteResult(`Successfully deleted ${data.deleted.length} file(s).`)
      }
    } catch (err: any) {
      setDeleteResult(
        `Error: ${err.message || "An unexpected error occurred."}`
      )
    } finally {
      setDeleteLoading(false)
    }
  }, [
    session,
    selectedUrls,
    results,
    setSelectedUrls,
    onAfterDelete,
    onResultsChange,
  ])

  return {
    deleteConfirmInput,
    setDeleteConfirmInput,
    deleteLoading,
    deleteResult,
    setDeleteResult,
    closeDeleteModal,
    handleDelete,
  }
}
