import * as React from "react"
import { useSession } from "next-auth/react"
import { lookupByThumbnail, searchBySpecies, searchByTags, detectImageTags } from "@/lib/api"
import { formatFileResults, type FileResult } from "@/lib/file-results"
import { validateUploadedFile } from "@/lib/file-utils"
import { useFileDragAndDrop } from "@/hooks/use-file-drag-drop"
import { getPresignedUrl } from "@/lib/upload-actions"
import { calculateChecksum, uploadFileToS3 } from "@/lib/s3-client"

export type TagCountInput = {
  id: string
  tag: string
  count: number | ""
}

const MAX_SIZE_BYTES = 1024 * 1024 * 1024 // 1GB

export function useSearchState() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = React.useState<string>("tags-count")
  const nextRowIdRef = React.useRef<number>(2)

  // Tab 1 state
  const [tagsCount, setTagsCount] = React.useState<TagCountInput[]>([
    { id: "1", tag: "", count: 1 },
  ])

  // Tab 2 state
  const [tagsOnly, setTagsOnly] = React.useState<string[]>([])
  const [tagsOnlyInput, setTagsOnlyInput] = React.useState<string>("")

  // Tab 3 state
  const [thumbnailUrl, setThumbnailUrl] = React.useState<string>("")

  // Tab 4 state
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)

  // Search execution states
  const [searching, setSearching] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)
  const [results, setResults] = React.useState<FileResult[] | null>(null)
  const [hasSearched, setHasSearched] = React.useState(false)
  const [detectedTags, setDetectedTags] = React.useState<string[] | null>(null)

  // Disabled logic
  const isSearchDisabled = React.useMemo(() => {
    if (activeTab === "tags-count") {
      return (
        tagsCount.length === 0 ||
        tagsCount.some((row) => row.tag.trim() === "" || row.count === "")
      )
    }
    if (activeTab === "tags-only") {
      return tagsOnly.length === 0 && tagsOnlyInput.trim() === ""
    }
    if (activeTab === "thumbnail") return thumbnailUrl.trim() === ""
    if (activeTab === "file") return selectedFile === null
    return true
  }, [activeTab, tagsCount, tagsOnly, tagsOnlyInput, thumbnailUrl, selectedFile])

  // Tab 1 handlers
  const addTagRow = React.useCallback(() => {
    const nextId = nextRowIdRef.current.toString()
    nextRowIdRef.current += 1
    setTagsCount((prev) => [...prev, { id: nextId, tag: "", count: 1 }])
  }, [])

  const removeTagRow = React.useCallback((id: string) => {
    setTagsCount((prev) => {
      if (prev.length === 1) return prev
      return prev.filter((row) => row.id !== id)
    })
  }, [])

  const updateTagRow = React.useCallback(
    (id: string, field: "tag" | "count", value: string | number) => {
      setTagsCount((prev) =>
        prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
      )
    },
    []
  )

  // Tab 4 helpers
  const validateAndSetFile = React.useCallback((file: File) => {
    const errorMsg = validateUploadedFile(file, MAX_SIZE_BYTES)
    if (errorMsg) {
      setError(errorMsg)
      return
    }
    setSelectedFile(file)
  }, [])

  const { dragActive, handleDrag, handleDrop } =
    useFileDragAndDrop(validateAndSetFile)

  const handleFileChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        validateAndSetFile(e.target.files[0])
      }
    },
    [validateAndSetFile]
  )

  const removeSelectedFile = React.useCallback(() => {
    setSelectedFile(null)
    setError(null)
    const fileInput = document.getElementById(
      "search-file-input"
    ) as HTMLInputElement
    if (fileInput) fileInput.value = ""
  }, [])

  // API calls
  const searchTagsCount = React.useCallback(
    async (tags: TagCountInput[]): Promise<FileResult[]> => {
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
    },
    [session]
  )

  const searchTagsOnly = React.useCallback(
    async (tags: string[]): Promise<FileResult[]> => {
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
    },
    [session]
  )

  const searchThumbnail = React.useCallback(
    async (url: string): Promise<FileResult[]> => {
      const idToken = (session as { idToken?: string })?.idToken
      if (!idToken) {
        throw new Error("Not authenticated. Please log in again.")
      }
      const data = await lookupByThumbnail(idToken, url)
      const userEmail = session?.user?.email || ""
      return formatFileResults([data], userEmail)
    },
    [session]
  )

  const searchFile = React.useCallback(
    async (file: File | null): Promise<FileResult[]> => {
      const idToken = (session as { idToken?: string })?.idToken
      if (!idToken) {
        throw new Error("Not authenticated. Please log in again.")
      }
      if (!file) {
        throw new Error("Please select a file to search.")
      }

      // 1. Calculate file checksum
      const computedChecksum = await calculateChecksum(file)

      // 2. Request S3 presigned URL with tmpQuery: true
      const presignData = await getPresignedUrl(
        file.name,
        file.type,
        computedChecksum,
        true
      )

      // 3. Upload file bytes directly to S3
      await uploadFileToS3(
        presignData.url,
        file,
        computedChecksum,
        presignData.user_email,
        presignData.file_id
      )

      // 4. Poll /detect-image-tags every 2 seconds for results
      let attempts = 0
      const maxAttempts = 30 // up to 60 seconds
      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

      while (attempts < maxAttempts) {
        attempts++
        const response = await detectImageTags(idToken, presignData.file_id)
        if (response.status === "success") {
          const userEmail = session?.user?.email || ""
          setDetectedTags(response.detected_tags || [])
          return formatFileResults(response.results || [], userEmail)
        }
        await delay(2000)
      }

      throw new Error("Search timed out waiting for ML inference. Please try again.")
    },
    [session]
  )

  const handleSearch = React.useCallback(async () => {
    setHasSearched(true)
    setSearching(true)
    setError(null)
    setResults(null)
    setDetectedTags(null)

    try {
      let data: FileResult[] = []

      if (activeTab === "tags-count") {
        const validTags = tagsCount
          .filter((t) => t.tag.trim() !== "")
          .map((t) => ({ ...t, count: t.count === "" ? 1 : Number(t.count) }))
        if (validTags.length === 0) {
          throw new Error("Please specify at least one tag.")
        }
        data = await searchTagsCount(validTags)
      } else if (activeTab === "tags-only") {
        const queryTags = [...tagsOnly]
        if (tagsOnlyInput.trim()) {
          queryTags.push(tagsOnlyInput.trim().toLowerCase())
        }
        if (queryTags.length === 0) {
          throw new Error("Please input at least one tag/species.")
        }
        data = await searchTagsOnly(queryTags)
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
    } catch (err: unknown) {
      console.error(err)
      const message =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during search."
      setError(message)
    } finally {
      setSearching(false)
    }
  }, [
    activeTab,
    tagsCount,
    tagsOnly,
    tagsOnlyInput,
    thumbnailUrl,
    selectedFile,
    searchTagsCount,
    searchTagsOnly,
    searchThumbnail,
    searchFile,
  ])

  return {
    activeTab,
    setActiveTab,
    tagsCount,
    tagsOnly,
    setTagsOnly,
    tagsOnlyInput,
    setTagsOnlyInput,
    thumbnailUrl,
    setThumbnailUrl,
    selectedFile,
    dragActive,
    handleDrag,
    handleDrop,
    handleFileChange,
    removeSelectedFile,
    handleSearch,
    searching,
    error,
    results,
    setResults,
    hasSearched,
    isSearchDisabled,
    addTagRow,
    removeTagRow,
    updateTagRow,
    detectedTags,
  }
}

export type SearchContextValue = ReturnType<typeof useSearchState>

export const SearchContext = React.createContext<SearchContextValue | null>(null)

export function useSearch() {
  const context = React.useContext(SearchContext)
  if (!context) {
    throw new Error("useSearch must be used within SearchProvider")
  }
  return context
}
