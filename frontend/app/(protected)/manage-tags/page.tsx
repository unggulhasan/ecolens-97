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
import { Input } from "@/components/ui/input"
import { manageTags } from "@/lib/api"
import type { ManageTagsResult } from "@/lib/api"

export default function ManageTagsPage() {
  const { data: session } = useSession()

  // File URLs input — one per line
  const [urlsInput, setUrlsInput] = React.useState<string>("")

  // Tags input — comma separated
  const [tagsInput, setTagsInput] = React.useState<string>("")

  // Operation — 1 = add, 0 = remove
  const [operation, setOperation] = React.useState<1 | 0>(1)

  // UI state
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<ManageTagsResult | null>(null)

  const isDisabled = !urlsInput.trim() || !tagsInput.trim() || loading

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    const idToken = (session as any)?.idToken as string
    if (!idToken) {
      setError("Not authenticated. Please log in again.")
      setLoading(false)
      return
    }

    // Parse URLs — one per line, ignore empty lines
    const file_urls = urlsInput
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean)

    // Parse tags — comma separated, ignore empty
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)

    if (file_urls.length === 0) {
      setError("Please enter at least one file URL.")
      setLoading(false)
      return
    }

    if (tags.length === 0) {
      setError("Please enter at least one tag.")
      setLoading(false)
      return
    }

    try {
      const data = await manageTags(idToken, { file_urls, tags, operation })
      setResult(data)
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
          <h1 className="page-title">Manage Tags</h1>
          <p className="page-description">
            Add or remove tags from one or more files.
          </p>
        </div>

        {/* Form */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Tag Operation</CardTitle>
            <CardDescription>
              Enter file URLs and the tags you want to add or remove.
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
                onChange={(e) => setUrlsInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter one S3 file URL per line.
              </p>
            </div>

            {/* Tags */}
            <div className="search-input-group">
              <span className="text-sm font-medium">Tags</span>
              <Input
                placeholder="e.g. koala, dingo, wombat"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of tags to add or remove.
              </p>
            </div>

            {/* Operation toggle */}
            <div className="search-input-group">
              <span className="text-sm font-medium">Operation</span>
              <div className="flex gap-3">
                <button
                  onClick={() => setOperation(1)}
                  className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${
                    operation === 1
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  }`}
                >
                  Add Tags
                </button>
                <button
                  onClick={() => setOperation(0)}
                  className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${
                    operation === 0
                      ? "bg-red-800 text-white border-red-800"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  }`}
                >
                  Remove Tags
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="upload-error">{error}</div>
            )}

            {/* Submit */}
            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={isDisabled}
                className="upload-action-button"
              >
                {loading && (
                  <svg className="upload-spinner" fill="none" viewBox="0 0 24 24">
                    <circle className="upload-spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="upload-spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {loading ? "Processing..." : operation === 1 ? "Add Tags" : "Remove Tags"}
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
                {result.updated.length} updated · {result.failed.length} failed
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">

              {/* Updated */}
              {result.updated.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-primary">
                    Successfully Updated
                  </span>
                  {result.updated.map((item, i) => (
                    <div
                      key={i}
                      className="selected-file-card flex-col items-start gap-1"
                    >
                      <p className="text-xs text-muted-foreground break-all">
                        {item.file_url}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.final_tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
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