"use client"

import * as React from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useSearch } from "@/hooks/use-search"
import { SearchTabTagsCount } from "@/components/search-tab-tags-count"
import { SearchTabTagsOnly } from "@/components/search-tab-tags-only"
import { SearchTabThumbnail } from "@/components/search-tab-thumbnail"
import { SearchTabFile } from "@/components/search-tab-file"
import { FileResultsPanel } from "@/components/file-results-panel"

export function SearchContainer() {
  const {
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
  } = useSearch()

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Search Parameters</CardTitle>
        <CardDescription>
          Select a search category and enter your query terms.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          defaultValue="tags-count"
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="search-tabs-list">
            <TabsTrigger value="tags-count">
              Tags with Minimum Count
            </TabsTrigger>
            <TabsTrigger value="tags-only">Tags Only</TabsTrigger>
            <TabsTrigger value="thumbnail">Thumbnail&#39;s URL</TabsTrigger>
            <TabsTrigger value="file">File</TabsTrigger>
          </TabsList>

          {/* Tab 1 */}
          <TabsContent value="tags-count" className="space-y-4">
            <SearchTabTagsCount
              tagsCount={tagsCount}
              addTagRow={addTagRow}
              removeTagRow={removeTagRow}
              updateTagRow={updateTagRow}
            />
          </TabsContent>

          {/* Tab 2 */}
          <TabsContent value="tags-only" className="space-y-4">
            <SearchTabTagsOnly
              tagsOnly={tagsOnly}
              setTagsOnly={setTagsOnly}
              tagsOnlyInput={tagsOnlyInput}
              setTagsOnlyInput={setTagsOnlyInput}
            />
          </TabsContent>

          {/* Tab 3 */}
          <TabsContent value="thumbnail" className="space-y-4">
            <SearchTabThumbnail
              thumbnailUrl={thumbnailUrl}
              setThumbnailUrl={setThumbnailUrl}
            />
          </TabsContent>

          {/* Tab 4 */}
          <TabsContent value="file" className="space-y-4">
            <SearchTabFile
              selectedFile={selectedFile}
              dragActive={dragActive}
              handleFileChange={handleFileChange}
              removeSelectedFile={removeSelectedFile}
              handleDrag={handleDrag}
              handleDrop={handleDrop}
            />
          </TabsContent>

          {/* Search button */}
          <div className="mt-6 flex flex-col gap-4 border-t pt-6">
            {error && <div className="upload-error">{error}</div>}
            <div className="flex justify-end">
              <Button
                onClick={handleSearch}
                disabled={searching || isSearchDisabled}
                className="upload-action-button"
              >
                {searching && (
                  <svg
                    className="upload-spinner"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
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
                {searching ? "Searching..." : "Execute Search"}
              </Button>
            </div>
          </div>
        </Tabs>

        {hasSearched && (
          <FileResultsPanel
            title="Search Results"
            results={results}
            loading={searching}
            onResultsChange={setResults}
            detectedTags={detectedTags}
            emptyMessage="No matching files found."
          />
        )}
      </CardContent>
    </Card>
  )
}
