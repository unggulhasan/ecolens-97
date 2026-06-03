export async function calculateChecksum(file: File): Promise<string> {
  const fileBuffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer)
  const bytes = new Uint8Array(hashBuffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export async function uploadFileToS3(
  url: string,
  file: File,
  checksum: string,
  userEmail: string,
  userFieldId: string,
): Promise<void> {
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
      "x-amz-checksum-sha256": checksum,
      "x-amz-meta-user-email": userEmail,
      "x-amz-meta-file-id": userFieldId,
    },
    body: file,
  })

  if (!response.ok) {
    throw new Error(`S3 upload failed with status code ${response.status}`)
  }
}
