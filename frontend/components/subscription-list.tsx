import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { SubscriptionItem } from "@/hooks/use-subscriptions"

type SubscriptionListProps = {
  subscriptions: SubscriptionItem[]
  checkingStatus: boolean
  loading: boolean
  onEdit: (sub: SubscriptionItem) => void
  onDelete: (email: string) => void
}

export function SubscriptionList({
  subscriptions,
  checkingStatus,
  loading,
  onEdit,
  onDelete
}: SubscriptionListProps) {
  return (
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
          <div className="sub-pending-indicator">
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
              <div key={sub.email} className="sub-row">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">{sub.email}</span>
                    
                    {sub.status === "verified" ? (
                      <span className="sub-badge-verified">
                        <svg className="size-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Verified
                      </span>
                    ) : (
                      <span className="sub-badge-pending">
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
                        <span key={tag} className="sub-tag-badge">
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
                    onClick={() => onEdit(sub)}
                    disabled={loading || checkingStatus}
                  >
                    Edit Tags
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => onDelete(sub.email)}
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
              You haven&#39;t configured any email subscriptions yet. Add an email below to get started.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
