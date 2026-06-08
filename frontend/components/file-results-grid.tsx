import * as React from "react"
import { isVideoFile, type FileResult } from "@/lib/file-results"

type FileResultsGridProps = {
  results: FileResult[]
  selectedUrls: Set<string>
  onToggleSelect: (url: string) => void
  onClearSelection: () => void
  onSelectAll: () => void
}

export function FileResultsGrid({
  results,
  selectedUrls,
  onToggleSelect,
  onClearSelection,
  onSelectAll,
}: FileResultsGridProps) {
  const anySelected = selectedUrls.size > 0

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={anySelected ? onClearSelection : onSelectAll}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {anySelected ? "Clear selection" : "Select all"}
        </button>
      </div>
      <div className="search-results-grid">
        {results.map((result, index) => {
          const isVideo = isVideoFile(result.s3Url)
          const isSelected = selectedUrls.has(result.s3Url)

          return (
            <div
              key={index}
              className={`search-result-card group cursor-pointer select-none ${
                isSelected ? "ring-2 ring-primary ring-offset-2" : ""
              }`}
              onClick={() => onToggleSelect(result.s3Url)}
            >
              <div
                className={`absolute top-2 left-2 z-10 flex h-5 w-5 items-center justify-center rounded border-2 transition-all bg-white ${
                  isSelected
                    ? "border-primary opacity-100"
                    : "border-primary opacity-0 group-hover:opacity-100"
                }`}
              >
                <div
                  className={`absolute inset-0 rounded bg-primary/15 transition-opacity ${
                    isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  }`}
                />
                {isSelected && (
                  <svg
                    className="relative z-10 h-3 w-3 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
              {!result.isOwner && (
                <div className="absolute top-2 right-2 z-10 rounded bg-black/50 px-1.5 py-0.5 text-xs text-white">
                  Not yours
                </div>
              )}
              {isVideo && result.url === result.fullUrl ? (
                <video
                  src={result.url}
                  className="search-result-image"
                  preload="metadata"
                />
              ) : (
                <img
                  src={result.url}
                  alt={`Result ${index + 1}`}
                  className="search-result-image"
                />
              )}
              <div className="search-result-overlay">
                <a
                  href={result.fullUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="search-result-link"
                  onClick={(e) => e.stopPropagation()}
                >
                  View Full File
                </a>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
