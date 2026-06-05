import type { SearchBySpeciesResponseItem } from "@/lib/api"

export type FileResult = {
  url: string
  fullUrl: string
  s3Url: string
  isOwner: boolean
  userId: string
  tags: Record<string, number>
}

export type PaginationMeta = {
  page: number
  pageSize: number
  total: number
}

export function formatFileResults(
  items: SearchBySpeciesResponseItem[],
  userEmail: string
): FileResult[] {
  return items.map((item) => ({
    url: item.thumbnail_url_http || item.file_url_http,
    fullUrl: item.file_url_http,
    s3Url: item.file_url,
    isOwner: item.user_id === userEmail,
    userId: item.user_id,
    tags: item.tags || {},
  }))
}

export function isVideoFile(s3Url: string) {
  const lower = s3Url.toLowerCase()
  return (
    lower.endsWith(".mp4") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".avi")
  )
}
