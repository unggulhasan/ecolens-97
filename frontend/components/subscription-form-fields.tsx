import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TagInput } from "@/components/tag-input"
import { WILDLIFE_SUGGESTIONS } from "@/lib/constants"

type SubscriptionFormFieldsProps = {
  email: string
  setEmail: (val: string) => void
  tags: string[]
  setTags: (val: string[]) => void
  loading: boolean
  isEditing: boolean
  error: string | null
  successMessage: string | null
  onSubmit: (e: React.FormEvent) => void
  onCancelEdit: () => void
}

export function SubscriptionFormFields({
  email,
  setEmail,
  tags,
  setTags,
  loading,
  isEditing,
  error,
  successMessage,
  onSubmit,
  onCancelEdit
}: SubscriptionFormFieldsProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          {isEditing ? "Edit Subscription Tags" : "Add Email Subscription"}
        </CardTitle>
        <CardDescription>
          {isEditing
            ? `Modify the target tags for ${email}. Updates apply instantly.`
            : "Subscribe an email address to receive alerts for specific wildlife species."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="sub-email"
              className="text-sm font-semibold text-foreground"
            >
              Notification Email Address
            </label>
            <Input
              id="sub-email"
              type="email"
              placeholder="your-email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full"
              disabled={loading || isEditing}
              required
            />
            <p className="text-xs text-muted-foreground">
              The address where species notifications will be sent.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="sub-tags"
              className="text-sm font-semibold text-foreground"
            >
              Species/Tags to Watch
            </label>
            <TagInput
              id="sub-tags"
              placeholder="Tag name (e.g. wombat)"
              tags={tags}
              onChange={setTags}
              suggestions={WILDLIFE_SUGGESTIONS}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Type a tag and press Enter or comma to confirm.
            </p>
          </div>

          {/* Verification Helper card */}
          {!isEditing && (
            <div className="sub-helper-card">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <svg
                  className="size-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>AWS SNS Verification Required</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                AWS requires email subscription verification. Once you
                subscribe, AWS will send you a confirmation email with subject{" "}
                <strong>"AWS Notification - Subscription Confirmation"</strong>.
                You must click the <strong>"Confirm Subscription"</strong> link
                in that email to activate alerts.
              </p>
            </div>
          )}

          {error && <div className="upload-error">{error}</div>}

          {successMessage && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300">
              <p className="mb-1 font-semibold">Success</p>
              <p className="text-xs leading-relaxed">{successMessage}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            {isEditing && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancelEdit}
                disabled={loading}
              >
                Cancel Edit
              </Button>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="upload-action-button"
            >
              {loading && (
                <svg className="upload-spinner" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="upload-spinner-circle"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="upload-spinner-path"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              {loading
                ? "Saving..."
                : isEditing
                  ? "Update Subscribed Tags"
                  : "Add Subscription"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
