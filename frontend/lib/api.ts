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
  updated: { file_url: string; final_tags: string[] }[]
  failed: { url: string; reason: string }[]
}

export async function manageTags(
  idToken: string,
  payload: ManageTagsRequest
): Promise<ManageTagsResult> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
  if (!baseUrl) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured")

  const response = await fetch(`${baseUrl}/query-5`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) throw new Error(`Query 5 returned ${response.status}`)
  return response.json()
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

  const response = await fetch(`${baseUrl}/query-6`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) throw new Error(`Query 6 returned ${response.status}`)
  return response.json()
}