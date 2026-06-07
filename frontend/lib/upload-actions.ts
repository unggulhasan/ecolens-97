"use server"

import { auth } from "@/auth"

export async function getPresignedUrl(
  filename: string,
  fileType: string,
  checksum: string,
  tmpQuery: boolean = false
) {
  const session = await auth()
  if (!session?.idToken) {
    throw new Error("Unauthorized: No session token found")
  }

  const apiBaseUrl = process.env.API_BASE_URL
  if (!apiBaseUrl) {
    throw new Error("API_BASE_URL environment variable is not defined")
  }

  const response = await fetch(`${apiBaseUrl}/presign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.idToken}`,
    },
    body: JSON.stringify({
      filename,
      file_type: fileType,
      checksum,
      tmp_query: tmpQuery,
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || "Failed to get presigned URL")
  }

  return data as {
    url: string
    key: string
    expires_in: number
    user_email: string
    file_id: string
  }
}
