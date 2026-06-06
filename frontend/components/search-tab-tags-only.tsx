import * as React from "react"
import { TagInput } from "@/components/ui/tag-input"
import { WILDLIFE_SUGGESTIONS } from "@/lib/constants"

type SearchTabTagsOnlyProps = {
  tagsOnly: string[]
  setTagsOnly: (tags: string[]) => void
  tagsOnlyInput: string
  setTagsOnlyInput: (input: string) => void
}

export function SearchTabTagsOnly({
  tagsOnly,
  setTagsOnly,
  tagsOnlyInput,
  setTagsOnlyInput,
}: SearchTabTagsOnlyProps) {
  return (
    <div className="search-input-group">
      <span className="text-sm font-medium">Enter Species/Tags</span>
      <TagInput
        placeholder="Tag name (e.g. wombat)"
        tags={tagsOnly}
        onChange={setTagsOnly}
        inputValue={tagsOnlyInput}
        onInputChange={setTagsOnlyInput}
        suggestions={WILDLIFE_SUGGESTIONS}
        className="bg-white dark:bg-slate-950"
      />
      <p className="text-xs text-muted-foreground">
        Type a tag and press Enter or comma to confirm. Matches files that
        contain at least one of each input tag.
      </p>
    </div>
  )
}
