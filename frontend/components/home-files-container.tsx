"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { listAllFiles } from "@/lib/api"
import {
  formatFileResults,
  type FileResult,
  type PaginationMeta,
} from "@/lib/file-results"
import { FileResultsPanel } from "@/components/file-results-panel"

type HomeTab = "all" | "mine"

const TAB_LABELS: Record<HomeTab, string> = {
  all: "All Files",
  mine: "My Files",
}

export function HomeFilesContainer() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = React.useState<HomeTab>("all")
  const [currentPage, setCurrentPage] = React.useState(1)
  const [results, setResults] = React.useState<FileResult[] | null>(null)
  const [pagination, setPagination] = React.useState<PaginationMeta | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const loadFiles = React.useCallback(
    async (tab: HomeTab, page: number) => {
      const idToken = (session as { idToken?: string })?.idToken
      if (!idToken) return

      setLoading(true)
      setError(null)

      try {
        const data = await listAllFiles(idToken, page, { mine: tab === "mine" })
        const userEmail = session?.user?.email || ""
        setResults(formatFileResults(data.results, userEmail))
        setPagination({
          page: data.page,
          pageSize: data.page_size,
          total: data.total,
        })
        setCurrentPage(data.page)
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to load files."
        setError(message)
        setResults([])
        setPagination(null)
      } finally {
        setLoading(false)
      }
    },
    [session]
  )

  React.useEffect(() => {
    loadFiles(activeTab, 1)
  }, [activeTab, loadFiles])

  const handlePageChange = (page: number) => {
    loadFiles(activeTab, page)
  }

  const handleAfterDelete = async (deletedCount: number) => {
    if (!pagination) return

    const newTotal = Math.max(0, pagination.total - deletedCount)
    const totalPages = Math.max(1, Math.ceil(newTotal / pagination.pageSize))
    const targetPage = Math.min(currentPage, totalPages)
    await loadFiles(activeTab, targetPage)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Your Files</CardTitle>
        <CardDescription>
          Browse every upload in the system or focus on files you have uploaded.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as HomeTab)}
          className="w-full"
        >
          <TabsList className="home-tabs-list">
            <TabsTrigger value="all">All Files</TabsTrigger>
            <TabsTrigger value="mine">My Files</TabsTrigger>
          </TabsList>
        </Tabs>

        {error && <div className="upload-error">{error}</div>}

        <FileResultsPanel
          title={TAB_LABELS[activeTab]}
          statusLabel={
            activeTab === "mine" ? "Uploaded by you" : "All uploads"
          }
          results={results}
          loading={loading}
          pagination={pagination}
          onPageChange={handlePageChange}
          onAfterDelete={handleAfterDelete}
          emptyMessage={
            activeTab === "mine"
              ? "You have not uploaded any files yet."
              : "No files on this page."
          }
        />
      </CardContent>
    </Card>
  )
}
