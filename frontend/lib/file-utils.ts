/**
 * Formats a file size in bytes to a human-readable string (KB, MB, GB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }
  return `${(bytes / 1024).toFixed(1)} KB`
}

/**
 * Validates whether a file type is allowed (image or video).
 */
export function isValidFileType(type: string): boolean {
  return type.startsWith("image/") || type.startsWith("video/")
}

/**
 * Validates a file's type and optionally its size.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateUploadedFile(file: File, maxSizeBytes?: number): string | null {
  if (!isValidFileType(file.type)) {
    return "Only image and video files are allowed."
  }
  if (maxSizeBytes && file.size > maxSizeBytes) {
    return `File size exceeds the ${formatFileSize(maxSizeBytes)} limit.`
  }
  return null
}
