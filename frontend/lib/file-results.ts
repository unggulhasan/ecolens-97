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

export function countOthersInSelection(
  results: FileResult[] | null,
  urls: Iterable<string>
): number {
  if (!results) return 0
  return Array.from(urls).filter(
    (url) => !results.find((r) => r.s3Url === url)?.isOwner
  ).length
}

export type TagUpdate = {
  file_url: string
  final_tags: Record<string, number>
}

export function applyTagUpdates(
  results: FileResult[] | null,
  updates: TagUpdate[]
): FileResult[] | null {
  if (!results) return results
  const updateMap = new Map(updates.map((u) => [u.file_url, u.final_tags]))
  return results.map((r) => {
    const tags = updateMap.get(r.s3Url)
    return tags !== undefined ? { ...r, tags } : r
  })
}

export function canDeleteSelection(
  results: FileResult[] | null,
  urls: Iterable<string>
): boolean {
  if (!results) return false
  const selected = Array.from(urls)
  if (selected.length === 0) return false
  return selected.every((url) =>
    results.some((r) => r.s3Url === url && r.isOwner)
  )
}
