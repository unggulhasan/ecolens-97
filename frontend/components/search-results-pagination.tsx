"use client"

import { Button } from "@/components/ui/button"

type SearchResultsPaginationProps = {
  page: number
  pageSize: number
  total: number
  loading?: boolean
  onPageChange: (page: number) => void
}

export function SearchResultsPagination({
  page,
  pageSize,
  total,
  loading = false,
  onPageChange,
}: SearchResultsPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total)

  return (
    <div className="search-results-pagination">
      <p className="search-results-pagination-info">
        Showing {rangeStart}&ndash;{rangeEnd} of {total} file{total === 1 ? "" : "s"}
      </p>
      <div className="search-results-pagination-controls">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span className="search-results-pagination-page">
          Page {page} of {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
