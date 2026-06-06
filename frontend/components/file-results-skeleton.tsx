import * as React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"

type FileResultsSkeletonProps = {
  title: string
  statusLabel?: string
}

export function FileResultsSkeleton({
  title,
  statusLabel,
}: FileResultsSkeletonProps) {
  return (
    <div className="search-results-list">
      <div className="search-results-list-header">
        <h3 className="search-results-list-title">{title}</h3>
        <span className="search-results-list-status">
          {statusLabel ?? "Loading..."}
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead className="w-16">Thumbnail</TableHead>
            <TableHead>URL</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Owner</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }, (_, i) => (
            <TableRow key={i} className="search-results-list-skeleton-row">
              <TableCell>
                <Skeleton className="size-5 rounded" />
              </TableCell>
              <TableCell>
                <Skeleton className="size-12 rounded-lg" />
              </TableCell>
              <TableCell className="max-w-xs">
                <Skeleton className="h-3 w-full max-w-xs" />
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-12 rounded-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
