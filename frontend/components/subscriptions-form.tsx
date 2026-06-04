"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { subscribeToTag, getSubscriptionStatus } from "@/lib/subscription-actions"

type SubscriptionsFormProps = {
  initialEmail?: string | null
}

export function SubscriptionsForm({ initialEmail }: SubscriptionsFormProps) {
  const [email, setEmail] = React.useState(initialEmail || "")
  const [tagsString, setTagsString] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [checkingStatus, setCheckingStatus] = React.useState(false)
  const [status, setStatus] = React.useState<"verified" | "pending" | "not_subscribed" | "idle">("idle")
  const [error, setError] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)

  // Fetch subscription status on load or email change
  const fetchStatus = React.useCallback(async (emailToCheck: string) => {
    if (!emailToCheck.trim()) return
    setCheckingStatus(true)
    setError(null)
    try {
      const data = await getSubscriptionStatus(emailToCheck.trim())
      setStatus(data.status)
      if (data.status === "verified" && data.tags) {
        setTagsString(data.tags.join(", "))
      } else {
        setTagsString("")
      }
    } catch (err: any) {
      console.error("Error fetching subscription status:", err)
      setStatus("not_subscribed")
    } finally {
      setCheckingStatus(false)
    }
  }, [])

  React.useEffect(() => {
    if (initialEmail) {
      fetchStatus(initialEmail)
    }
  }, [initialEmail, fetchStatus])

  const handleCheckStatus = () => {
    if (!email.trim()) {
      setError("Please enter an email address to check.")
      return
    }
    setSuccessMessage(null)
    fetchStatus(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!email.trim()) {
      setError("Email address is required.")
      return
    }

    if (!tagsString.trim()) {
      setError("Please specify at least one species tag to subscribe to.")
      return
    }

    const tags = tagsString
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0)

    if (tags.length === 0) {
      setError("Please enter valid comma-separated tags.")
      return
    }

    setLoading(true)
    try {
      const result = await subscribeToTag(email.trim(), tags)
      
      if (result.status === "verified") {
        setSuccessMessage(`Subscription updated successfully! Subscribed tags: ${tags.join(", ")}`)
        setStatus("verified")
      } else {
        setSuccessMessage(
          `Subscription requested! AWS has sent a confirmation email to ${email.trim()}. ` +
          `Please check your inbox (and spam folder) and click the link in that email to confirm your subscription.`
        )
        setStatus("pending")
      }
      
      // Sync status from AWS
      fetchStatus(email.trim())
    } catch (err: any) {
      console.error(err)
      setError(err.message || "An error occurred while creating subscription.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Subscribe to Wildlife Alerts</CardTitle>
        <CardDescription>
          Receive email notifications when new images or videos with specific species are uploaded or updated.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label htmlFor="sub-email" className="text-sm font-semibold text-foreground">
                Email Address
              </label>
              
              {/* Display Status Badge */}
              <div className="flex items-center gap-2">
                {checkingStatus && (
                  <span className="text-xs text-muted-foreground animate-pulse">Checking status...</span>
                )}
                
                {!checkingStatus && status === "verified" && (
                  <div className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <svg className="size-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Email Verified</span>
                  </div>
                )}
                
                {!checkingStatus && status === "pending" && (
                  <div className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <svg className="size-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Pending Verification</span>
                  </div>
                )}
                
                {!checkingStatus && status === "not_subscribed" && (
                  <div className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground border border-border">
                    <span>Not Subscribed</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Input
                id="sub-email"
                type="email"
                placeholder="your-email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
                disabled={loading || checkingStatus}
                required
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCheckStatus}
                disabled={loading || checkingStatus || !email}
              >
                {checkingStatus ? "Checking..." : "Check Status"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Notifications will be sent to this email address. Click "Check Status" to refresh verification state.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="sub-tags" className="text-sm font-semibold text-foreground">
              {status === "verified" ? "Update Subscribed Species/Tags" : "Species/Tags to Watch"}
            </label>
            <Input
              id="sub-tags"
              type="text"
              placeholder="e.g. kangaroo, koala, emu"
              value={tagsString}
              onChange={(e) => setTagsString(e.target.value)}
              className="w-full"
              disabled={loading || checkingStatus}
              required
            />
            <p className="text-xs text-muted-foreground">
              Enter a comma-separated list of species. You can edit and update this list freely at any time.
            </p>
          </div>

          {/* Verification Helper card */}
          {status !== "verified" && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-foreground/90 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>AWS SNS Verification Required</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                AWS requires email subscription verification. Once you subscribe, AWS will send you a confirmation email with subject <strong>"AWS Notification - Subscription Confirmation"</strong>. You must click the <strong>"Confirm Subscription"</strong> link in that email to activate alerts.
              </p>
            </div>
          )}

          {status === "verified" && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-foreground/90 space-y-1">
              <div className="flex items-center gap-2 font-semibold text-emerald-600 dark:text-emerald-400">
                <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Subscription Fully Active</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Your email is already verified. You can change your subscribed species above and save them directly. Updates will apply instantly without requiring re-verification.
              </p>
            </div>
          )}

          {error && (
            <div className="upload-error">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300">
              <p className="font-semibold mb-1">Success</p>
              <p className="text-xs leading-relaxed">{successMessage}</p>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={loading || checkingStatus} className="upload-action-button">
              {loading && (
                <svg className="upload-spinner" fill="none" viewBox="0 0 24 24">
                  <circle className="upload-spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="upload-spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {loading ? "Saving..." : status === "verified" ? "Update Subscribed Tags" : "Subscribe to Alerts"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
