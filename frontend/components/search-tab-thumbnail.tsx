import * as React from "react"
import { Input } from "@/components/ui/input"

type SearchTabThumbnailProps = {
  thumbnailUrl: string
  setThumbnailUrl: (url: string) => void
}

export function SearchTabThumbnail({
  thumbnailUrl,
  setThumbnailUrl,
}: SearchTabThumbnailProps) {
  return (
    <div className="search-input-group">
      <span className="text-sm font-medium">Thumbnail URL</span>
      <Input
        placeholder="s3://aussie-ecolens-s3-media/thumbnails/thumbnail.png"
        value={thumbnailUrl}
        onChange={(e) => setThumbnailUrl(e.target.value)}
        className="bg-white dark:bg-slate-950"
      />
      <p className="text-xs text-muted-foreground">
        Enter the exact S3 URI of the thumbnail to find the original full-sized
        file.
      </p>
    </div>
  )
}
