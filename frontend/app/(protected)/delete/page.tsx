"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { deleteFiles } from "@/lib/api"
import type { DeleteFilesResult } from "@/lib/api"

export default function DeleteFilesPage() {
  const { data: session } = useSession()

  // File URLs — one per line
  const [urlsInput, setUrlsInput] = React.useState<string>("")

  // UI state
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<DeleteFilesResult | null>(null)

  // Confirmation gate — user must confirm before deleting
  const [confirmed, setConfirmed] = React.useState(false)

  const isDisabled = !urlsInput.trim() || !confirmed || loading

  const handleDelete = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    const idToken = (session as any)?.idToken as string
    if (!idToken) {
      setError("Not authenticated. Please log in again.")
      setLoading(false)
      return
    }

    const urls = urlsInput
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean)

    if (urls.length === 0) {
      setError("Please enter at least one file URL.")
      setLoading(false)
      return
    }

    try {
      const data = await deleteFiles(idToken, { urls })
      setResult(data)
      // Reset confirmation after action
      setConfirmed(false)
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-content-wrapper">

        {/* Header */}
        <div className="page-header">
          <h1 className="page-title">Delete Files</h1>
          <p className="page-description">
            Permanently remove files and their thumbnails from storage and the database.
          </p>
        </div>

        {/* Form */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Select Files to Delete</CardTitle>
            <CardDescription>
              This action is irreversible. Files will be removed from S3 and DynamoDB.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">

            {/* File URLs */}
            <div className="search-input-group">
              <span className="text-sm font-medium">File URLs</span>
              <textarea
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[120px] resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={`One URL per line, e.g.\ns3://aussie-ecolens-prod-media/images/uuid/koala.jpg\ns3://aussie-ecolens-prod-media/images/uuid/dingo.jpg`}
                value={urlsInput}
                onChange={(e) => {
                  setUrlsInput(e.target.value)
                  // Reset confirmation if URLs change
                  setConfirmed(false)
                }}
              />
              <p className="text-xs text-muted-foreground">
                Enter one S3 file URL per line.
              </p>
            </div>

            {/* Confirmation checkbox */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-destructive cursor-pointer"
              />
              <span className="text-sm text-muted-foreground">
                I understand this action is{" "}
                <span className="text-destructive font-semibold">
                  permanent and cannot be undone
                </span>
                .
              </span>
            </label>

            {/* Error */}
            {error && (
              <div className="upload-error">{error}</div>
            )}

            {/* Submit */}
            <div className="flex justify-end">
              <Button
                onClick={handleDelete}
                disabled={isDisabled}
                variant="destructive"
                className="upload-action-button"
              >
                {loading && (
                  <svg className="upload-spinner" fill="none" viewBox="0 0 24 24">
                    <circle className="upload-spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="upload-spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {loading ? "Deleting..." : "Delete Files"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Results</CardTitle>
              <CardDescription>
                {result.deleted.length} deleted · {result.failed.length} failed
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">

              {/* Deleted */}
              {result.deleted.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-primary">
                    Successfully Deleted
                  </span>
                  {result.deleted.map((url, i) => (
                    <div key={i} className="selected-file-card">
                      <p className="text-xs text-muted-foreground break-all">
                        {url}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Failed */}
              {result.failed.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-destructive">
                    Failed
                  </span>
                  {result.failed.map((item, i) => (
                    <div
                      key={i}
                      className="selected-file-card flex-col items-start gap-1"
                    >
                      <p className="text-xs text-muted-foreground break-all">
                        {item.url}
                      </p>
                      <p className="text-xs text-destructive">{item.reason}</p>
                    </div>
                  ))}
                </div>
              )}

            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}