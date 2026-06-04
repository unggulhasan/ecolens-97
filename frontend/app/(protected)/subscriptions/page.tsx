import { auth } from "@/auth"
import { SubscriptionsForm } from "@/components/subscriptions-form"

export default async function SubscriptionsPage() {
  const session = await auth()
  const userEmail = session?.user?.email || ""

  return (
    <div className="page-container">
      <div className="page-content-wrapper">
        <div className="page-header">
          <h1 className="page-title">Subscriptions</h1>
          <p className="page-description">
            Manage your tag-based email alerts.
          </p>
        </div>
        <SubscriptionsForm initialEmail={userEmail} />
      </div>
    </div>
  )
}
