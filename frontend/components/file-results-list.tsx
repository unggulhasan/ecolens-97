import * as React from "react"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { isVideoFile, type FileResult } from "@/lib/file-results"

type FileResultsListProps = {
  results: FileResult[]
  selectedUrls: Set<string>
  onToggleSelect: (url: string) => void
  onClearSelection: () => void
  onSelectAll: () => void
}

export function FileResultsList({
  results,
  selectedUrls,
  onToggleSelect,
  onClearSelection,
  onSelectAll,
}: FileResultsListProps) {
  const anySelected = selectedUrls.size > 0

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <div
              onClick={anySelected ? onClearSelection : onSelectAll}
              className={`relative flex h-5 w-5 cursor-pointer items-center justify-center rounded border-2 transition-colors bg-white ${
                anySelected
                  ? "border-primary"
                  : "border-border hover:border-primary"
              }`}
            >
              {anySelected && (
                <div className="absolute inset-0 rounded bg-primary/15" />
              )}
              {anySelected && (
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
          </TableHead>
          <TableHead className="w-16">Thumbnail</TableHead>
          <TableHead>URL</TableHead>
          <TableHead>Tags</TableHead>
          <TableHead>Owner</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {results.map((result, index) => {
          const isVideo = isVideoFile(result.s3Url)
          const isSelected = selectedUrls.has(result.s3Url)

          return (
            <TableRow
              key={index}
              className={`cursor-pointer select-none transition-colors ${
                isSelected
                  ? "bg-primary/5 hover:bg-primary/10"
                  : index % 2 === 0
                    ? "bg-background hover:bg-muted/50"
                    : "bg-muted/20 hover:bg-muted/50"
              }`}
              onClick={() => onToggleSelect(result.s3Url)}
            >
              <TableCell>
                <div
                  className={`relative flex h-5 w-5 items-center justify-center rounded border-2 transition-colors bg-white ${
                    isSelected ? "border-primary" : "border-border"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute inset-0 rounded bg-primary/15" />
                  )}
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
              </TableCell>
              <TableCell>
                <div className="h-12 w-12 overflow-hidden rounded-lg bg-muted">
                  {isVideo ? (
                    <video
                      src={result.url}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <img
                      src={result.url}
                      alt={`Result ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
              </TableCell>
              <TableCell className="max-w-xs">
                <a
                  href={result.fullUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate block text-xs text-black underline-offset-2 hover:underline max-w-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  {result.s3Url}
                </a>
              </TableCell>
              <TableCell>
                {Object.keys(result.tags).length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {Object.keys(result.tags).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary uppercase tracking-wider"
                      >
                        {tag} ({result.tags[tag]})
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    -
                  </span>
                )}
              </TableCell>
              <TableCell>
                {result.isOwner ? (
                  <div className="flex flex-col">
                    <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary mb-0.5">
                      You
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {result.userId}
                    </span>
                  </div>
                ) : (
                  <span
                    className="text-xs text-muted-foreground"
                    title={result.userId}
                  >
                    {result.userId || "Other user"}
                  </span>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
