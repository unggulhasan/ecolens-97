"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileResultsPanel } from "@/components/file-results-panel"
import { useHomeFiles } from "@/components/home-files-provider"

const TAB_LABELS = {
  all: "All Files",
  mine: "My Files",
} as const

export function HomeFilesContainer() {
  const {
    activeTab,
    setActiveTab,
    tabStates,
    loading,
    changePage,
    refreshAfterDelete,
  } = useHomeFiles()

  const currentTab = tabStates[activeTab]
  const showLoading = loading && !currentTab.initialized

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
          onValueChange={(value) => setActiveTab(value as "all" | "mine")}
          className="w-full"
        >
          <TabsList className="home-tabs-list">
            <TabsTrigger value="all">All Files</TabsTrigger>
            <TabsTrigger value="mine">My Files</TabsTrigger>
          </TabsList>
        </Tabs>

        {currentTab.error && (
          <div className="upload-error">{currentTab.error}</div>
        )}

        <FileResultsPanel
          title={TAB_LABELS[activeTab]}
          statusLabel={
            activeTab === "mine" ? "Uploaded by you" : "All uploads"
          }
          results={currentTab.results}
          loading={showLoading}
          pagination={currentTab.pagination}
          onPageChange={changePage}
          onAfterDelete={refreshAfterDelete}
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
