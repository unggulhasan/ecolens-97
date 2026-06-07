import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AutocompleteInput } from "@/components/autocomplete-input"
import { WILDLIFE_SUGGESTIONS } from "@/lib/constants"
import { type TagCountInput } from "@/hooks/use-search"

type SearchTabTagsCountProps = {
  tagsCount: TagCountInput[]
  addTagRow: () => void
  removeTagRow: (id: string) => void
  updateTagRow: (
    id: string,
    field: "tag" | "count",
    value: string | number
  ) => void
}

export function SearchTabTagsCount({
  tagsCount,
  addTagRow,
  removeTagRow,
  updateTagRow,
}: SearchTabTagsCountProps) {
  return (
    <div className="search-input-group">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Query Tags</span>
        <Button onClick={addTagRow} variant="outline" size="sm" className="h-8">
          <svg
            className="mr-1 size-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Tag
        </Button>
      </div>
      <div className="space-y-3">
        {tagsCount.map((row) => (
          <div key={row.id} className="search-tag-row">
            <AutocompleteInput
              placeholder="Tag name (e.g. wombat)"
              value={row.tag}
              onChange={(e) => updateTagRow(row.id, "tag", e.target.value)}
              suggestions={WILDLIFE_SUGGESTIONS}
              className="flex-1 bg-white dark:bg-slate-950"
            />
            <Input
              type="number"
              min={1}
              value={row.count}
              onChange={(e) => {
                const val = e.target.value
                updateTagRow(
                  row.id,
                  "count",
                  val === "" ? "" : parseInt(val) || ""
                )
              }}
              onBlur={() => {
                if (
                  row.count === "" ||
                  isNaN(Number(row.count)) ||
                  Number(row.count) < 1
                ) {
                  updateTagRow(row.id, "count", 1)
                }
              }}
              className="w-24 bg-white dark:bg-slate-950"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeTagRow(row.id)}
              disabled={tagsCount.length === 1}
              className="shrink-0 text-destructive hover:bg-destructive/10"
            >
              <svg
                className="size-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
