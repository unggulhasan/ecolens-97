// ----------------------------- HELLO -----------------------------
export type HelloResponse = {
  message: string
}

export async function fetchHello(idToken: string): Promise<HelloResponse> {
  const baseUrl = process.env.API_BASE_URL
  if (!baseUrl) {
    throw new Error("API_BASE_URL is not configured")
  }

  const response = await fetch(`${baseUrl}/hello`, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Hello API returned ${response.status}`)
  }

  return response.json() as Promise<HelloResponse>
}


// ----------------------------- QUERY 5 — Manage Tags -----------------------------

export type ManageTagsRequest = {
  file_urls: string[]
  tags: string[]
  operation: 0 | 1  // 1 = add, 0 = remove
}

export type ManageTagsResult = {
  updated: { file_url: string; final_tags: Record<string, number> }[]
  failed: { url: string; reason: string }[]
}

export async function manageTags(
  idToken: string,
  payload: ManageTagsRequest
): Promise<ManageTagsResult> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
  if (!baseUrl) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured")

  const response = await fetch(`${baseUrl}/update-file-tags`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      typeof data?.error === "string"
        ? data.error
        : `update-file-tags returned ${response.status}`
    throw new Error(message)
  }

  return {
    updated: data.updated ?? [],
    failed: data.failed ?? [],
  }
}

// ----------------------------- QUERY 6 — Delete Files ----------------------------

export type DeleteFilesRequest = {
  urls: string[]
}

export type DeleteFilesResult = {
  deleted: string[]
  failed: { url: string; reason: string }[]
}

export async function deleteFiles(
  idToken: string,
  payload: DeleteFilesRequest
): Promise<DeleteFilesResult> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
  if (!baseUrl) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured")

  const response = await fetch(`${baseUrl}/delete-media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) throw new Error(`delete-media returned ${response.status}`)
  return response.json()
}

// ----------------------------- QUERY 3 — Lookup by Thumbnail -------------------

export type LookupByThumbnailResponse = {
  file_url: string
  file_url_http: string
  thumbnail_url?: string
  thumbnail_url_http?: string
  user_id: string
  tags?: Record<string, number>
}

export async function lookupByThumbnail(
  idToken: string,
  thumbnailUrl: string
): Promise<LookupByThumbnailResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
  if (!baseUrl) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured")

  const response = await fetch(`${baseUrl}/lookup-by-thumbnail`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ thumbnail_url: thumbnailUrl }),
  })

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Thumbnail not found in the database")
    }
    throw new Error(`lookup-by-thumbnail returned ${response.status}`)
  }

  return response.json()
}

export type SearchBySpeciesResponseItem = {
  file_url: string
  file_url_http: string
  thumbnail_url?: string
  thumbnail_url_http?: string
  user_id: string
  tags?: Record<string, number>
}

export async function searchBySpecies(
  idToken: string,
  species: string[]
): Promise<SearchBySpeciesResponseItem[]> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
  if (!baseUrl) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured")

  const response = await fetch(`${baseUrl}/search-by-species`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ species }),
  })

  if (!response.ok) {
    throw new Error(`search-by-species returned ${response.status}`)
  }

  const data = await response.json()
  return (data.results || []) as SearchBySpeciesResponseItem[]
}

export async function searchByTags(
  idToken: string,
  tags: Record<string, number>
): Promise<SearchBySpeciesResponseItem[]> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
  if (!baseUrl) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured")

  const response = await fetch(`${baseUrl}/search-by-tags`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(tags),
  })

  if (!response.ok) {
    throw new Error(`search-by-tags returned ${response.status}`)
  }

  const data = await response.json()
  return (data.results || []) as SearchBySpeciesResponseItem[]
}

export type PaginatedFilesResponse = {
  page: number
  page_size: number
  total: number
  results: SearchBySpeciesResponseItem[]
}

export type ListAllFilesOptions = {
  mine?: boolean
}

export async function listAllFiles(
  idToken: string,
  page: number = 1,
  options: ListAllFilesOptions = {}
): Promise<PaginatedFilesResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
  if (!baseUrl) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured")

  const params = new URLSearchParams({ page: String(page) })
  if (options.mine) {
    params.set("mine", "true")
  }

  const response = await fetch(`${baseUrl}/all-files?${params.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`all-files returned ${response.status}`)
  }

  const data = await response.json()
  return {
    page: data.page ?? page,
    page_size: data.page_size ?? 10,
    total: data.total ?? 0,
    results: (data.results || []) as SearchBySpeciesResponseItem[],
  }
}