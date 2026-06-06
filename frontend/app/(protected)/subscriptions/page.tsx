import { auth } from "@/auth"
import { SubscriptionsForm } from "@/components/subscription-form"
import { listSubscriptions } from "@/lib/subscription-actions"

export default async function SubscriptionsPage() {
  const session = await auth()
  const userEmail = session?.user?.email || ""

  let initialSubscriptions: any[] = []
  let isAlreadySubscribed = false

  try {
    if (session?.idToken) {
      initialSubscriptions = await listSubscriptions()
      isAlreadySubscribed = initialSubscriptions.some(
        (sub) => sub.email.toLowerCase() === userEmail.toLowerCase()
      )
    }
  } catch (error) {
    console.error("Failed to load subscriptions on server side:", error)
  }

  return (
    <div className="page-container">
      <div className="page-content-wrapper">
        <div className="page-header">
          <h1 className="page-title">Subscriptions</h1>
          <p className="page-description">
            Manage your tag-based email alerts.
          </p>
        </div>
        <SubscriptionsForm 
          initialEmail={userEmail} 
          initialSubscriptions={initialSubscriptions}
          initialIsSubscribed={isAlreadySubscribed}
        />
      </div>
    </div>
  )
}

