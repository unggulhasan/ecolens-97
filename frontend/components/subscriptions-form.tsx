"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { subscribeToTag, listSubscriptions, unsubscribeEmail } from "@/lib/subscription-actions"

type SubscriptionItem = {
  email: string
  status: "verified" | "pending"
  tags: string[]
}

type SubscriptionsFormProps = {
  initialEmail?: string | null
  initialSubscriptions?: SubscriptionItem[]
  initialIsSubscribed?: boolean
}

export function SubscriptionsForm({ 
  initialEmail,
  initialSubscriptions = [],
  initialIsSubscribed = false
}: SubscriptionsFormProps) {
  const [subscriptions, setSubscriptions] = React.useState<SubscriptionItem[]>(initialSubscriptions)
  const [email, setEmail] = React.useState(initialIsSubscribed ? "" : (initialEmail || ""))
  const [tagsString, setTagsString] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [checkingStatus, setCheckingStatus] = React.useState(false)
  const [isEditing, setIsEditing] = React.useState(false)
  
  const [error, setError] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)

  // Fetch subscription list
  const fetchSubscriptions = React.useCallback(async (silent = false) => {
    if (!silent) setCheckingStatus(true)
    setError(null)
    try {
      const list = await listSubscriptions()
      setSubscriptions(list)
      
      // Auto-clear input email if the default account email is already subscribed
      if (initialEmail) {
        const isSubscribed = list.some((sub) => sub.email.toLowerCase() === initialEmail.toLowerCase())
        if (isSubscribed) {
          setEmail((prev) => (prev.toLowerCase() === initialEmail.toLowerCase() ? "" : prev))
        }
      }
    } catch (err: any) {
      console.error("Error fetching subscriptions:", err)
      setError("Failed to load subscription list. Make sure the API is available.")
    } finally {
      if (!silent) setCheckingStatus(false)
    }
  }, [initialEmail])

  // Initial load
  React.useEffect(() => {
    fetchSubscriptions()
  }, [fetchSubscriptions])

  // Automatically poll pending subscriptions in the background
  React.useEffect(() => {
    const hasPending = subscriptions.some((sub) => sub.status === "pending")
    if (!hasPending) return

    const intervalId = setInterval(() => {
      fetchSubscriptions(true)
    }, 5000)

    return () => clearInterval(intervalId)
  }, [subscriptions, fetchSubscriptions])

  const handleEdit = (sub: SubscriptionItem) => {
    setEmail(sub.email)
    setTagsString(sub.tags.join(", "))
    setIsEditing(true)
    setError(null)
    setSuccessMessage(null)
  }

  const handleCancelEdit = () => {
    const isSubscribed = subscriptions.some((sub) => sub.email.toLowerCase() === initialEmail?.toLowerCase())
    setEmail(isSubscribed ? "" : (initialEmail || ""))
    setTagsString("")
    setIsEditing(false)
    setError(null)
    setSuccessMessage(null)
  }

  const handleDelete = async (emailToDelete: string) => {
    setError(null)
    setSuccessMessage(null)
    setLoading(true)
    
    try {
      await unsubscribeEmail(emailToDelete)
      setSuccessMessage(`Successfully unsubscribed ${emailToDelete}.`)
      
      // Refresh list
      const list = await listSubscriptions()
      setSubscriptions(list)
      
      // If we deleted the primary email, it is no longer subscribed, so reset input email back to initialEmail
      const isSubscribed = list.some((sub) => sub.email.toLowerCase() === initialEmail?.toLowerCase())
      if (email === emailToDelete || email === "") {
        setEmail(isSubscribed ? "" : (initialEmail || ""))
      }
      
      if (email === emailToDelete) {
        setTagsString("")
        setIsEditing(false)
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || `Failed to unsubscribe ${emailToDelete}.`)
    } finally {
      setLoading(false)
    }
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
      setError("Please specify at least one species tag.")
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
        setSuccessMessage(`Subscription details successfully saved for ${email.trim()}!`)
      } else {
        setSuccessMessage(
          `Subscription requested! AWS has sent a confirmation email to ${email.trim()}. ` +
          `Please check your inbox (including spam) and click "Confirm Subscription" to activate alerts.`
        )
      }
      
      // Refresh list to show updated state
      const list = await listSubscriptions()
      setSubscriptions(list)
      
      // Reset form fields. Clear email input if primary email is now subscribed.
      const isSubscribed = list.some((sub) => sub.email.toLowerCase() === initialEmail?.toLowerCase())
      setEmail(isSubscribed ? "" : (initialEmail || ""))
      setTagsString("")
      setIsEditing(false)
    } catch (err: any) {
      console.error(err)
      setError(err.message || "An error occurred while creating subscription.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      
      {/* 1. Subscriptions List */}
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
          <div>
            <CardTitle>Active Subscriptions</CardTitle>
            <CardDescription>
              Emails currently configured to receive species notifications.
            </CardDescription>
          </div>
          
          {/* Status Indicator */}
          {subscriptions.some(s => s.status === "pending") && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium animate-pulse">
              <svg className="size-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Waiting for confirmation...</span>
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-6">
          {checkingStatus && subscriptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <svg className="upload-spinner size-6 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="upload-spinner-circle opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="upload-spinner-path opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-sm text-muted-foreground">Checking subscription statuses...</p>
            </div>
          ) : subscriptions.length > 0 ? (
            <div className="divide-y divide-border">
              {subscriptions.map((sub) => (
                <div key={sub.email} className="flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-4 first:pt-0 last:pb-0">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{sub.email}</span>
                      
                      {sub.status === "verified" ? (
                        <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <svg className="size-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Verified
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <svg className="size-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          Pending
                        </span>
                      )}
                    </div>
                    
                    {/* Tags List */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {sub.tags.length > 0 ? (
                        sub.tags.map((tag) => (
                          <span key={tag} className="inline-block text-[10px] font-bold uppercase tracking-wider bg-secondary text-secondary-foreground border px-2 py-0.5 rounded">
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No tags selected (alerts disabled)</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEdit(sub)}
                      disabled={loading || checkingStatus}
                    >
                      Edit Tags
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(sub.email)}
                      disabled={loading || checkingStatus}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2 border border-dashed rounded-lg bg-muted/20">
              <svg className="size-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <h3 className="font-semibold text-sm">No notifications configured</h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                You haven't configured any email subscriptions yet. Add an email below to get started.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Add / Edit Subscription Form */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{isEditing ? "Edit Subscription Tags" : "Add Email Subscription"}</CardTitle>
          <CardDescription>
            {isEditing 
              ? `Modify the target tags for ${email}. Updates apply instantly.` 
              : "Subscribe an email address to receive alerts for specific wildlife species."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="sub-email" className="text-sm font-semibold text-foreground">
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
              <label htmlFor="sub-tags" className="text-sm font-semibold text-foreground">
                Species/Tags to Watch
              </label>
              <Input
                id="sub-tags"
                type="text"
                placeholder="e.g. kangaroo, koala, emu"
                value={tagsString}
                onChange={(e) => setTagsString(e.target.value)}
                className="w-full"
                disabled={loading}
                required
              />
              <p className="text-xs text-muted-foreground">
                Enter a comma-separated list of species.
              </p>
            </div>

            {/* Verification Helper card */}
            {!isEditing && (
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

            <div className="flex justify-end gap-2 pt-2">
              {isEditing && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleCancelEdit} 
                  disabled={loading}
                >
                  Cancel Edit
                </Button>
              )}
              
              <Button type="submit" disabled={loading} className="upload-action-button">
                {loading && (
                  <svg className="upload-spinner" fill="none" viewBox="0 0 24 24">
                    <circle className="upload-spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="upload-spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {loading 
                  ? "Saving..." 
                  : isEditing 
                    ? "Update Subscribed Tags" 
                    : "Add Subscription"
                }
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

    </div>
  )
}
