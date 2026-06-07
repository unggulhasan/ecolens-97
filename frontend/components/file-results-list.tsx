import * as React from "react"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
} from "@/components/ui/table"
import type { FileResult } from "@/lib/file-results"
import { ListCheckbox } from "@/components/list-checkbox"
import { FileResultRow } from "@/components/file-result-row"

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
            <ListCheckbox
              checked={anySelected}
              onClick={anySelected ? onClearSelection : onSelectAll}
              className="cursor-pointer"
            />
          </TableHead>
          <TableHead className="w-16">Thumbnail</TableHead>
          <TableHead>URL</TableHead>
          <TableHead>Tags</TableHead>
          <TableHead>Owner</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {results.map((result, index) => {
          const isSelected = selectedUrls.has(result.s3Url)

          return (
            <FileResultRow
              key={result.s3Url}
              result={result}
              index={index}
              isSelected={isSelected}
              onToggleSelect={onToggleSelect}
            />
          )
        })}
      </TableBody>
    </Table>
  )
}
