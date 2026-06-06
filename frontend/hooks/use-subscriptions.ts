import * as React from "react"
import { subscribeToTag, listSubscriptions, unsubscribeEmail } from "@/lib/subscription-actions"

export type SubscriptionItem = {
  email: string
  status: "verified" | "pending"
  tags: string[]
}

export function useSubscriptions(
  initialEmail: string | null | undefined,
  initialSubscriptions: SubscriptionItem[],
  initialIsSubscribed: boolean
) {
  const [subscriptions, setSubscriptions] = React.useState<SubscriptionItem[]>(initialSubscriptions)
  const [email, setEmail] = React.useState(initialIsSubscribed ? "" : (initialEmail || ""))
  const [tagsString, setTagsString] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [checkingStatus, setCheckingStatus] = React.useState(false)
  const [isEditing, setIsEditing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)

  const fetchSubscriptions = React.useCallback(async (silent = false) => {
    if (!silent) setCheckingStatus(true)
    setError(null)
    try {
      const list = await listSubscriptions()
      setSubscriptions(list)
      
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
      
      const list = await listSubscriptions()
      setSubscriptions(list)
      
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
      
      const list = await listSubscriptions()
      setSubscriptions(list)
      
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

  return {
    subscriptions,
    email,
    setEmail,
    tagsString,
    setTagsString,
    loading,
    checkingStatus,
    isEditing,
    error,
    successMessage,
    handleEdit,
    handleCancelEdit,
    handleDelete,
    handleSubmit
  }
}
