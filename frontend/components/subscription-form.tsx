"use client"

import * as React from "react"
import { useSubscriptions } from "@/hooks/use-subscriptions"
import { SubscriptionList } from "@/components/subscription-list"
import { SubscriptionFormFields } from "@/components/subscription-form-fields"
import type { SubscriptionItem } from "@/hooks/use-subscriptions"

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
  const {
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
  } = useSubscriptions(initialEmail, initialSubscriptions, initialIsSubscribed)

  return (
    <div className="space-y-6">
      <SubscriptionList
        subscriptions={subscriptions}
        checkingStatus={checkingStatus}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <SubscriptionFormFields
        email={email}
        setEmail={setEmail}
        tagsString={tagsString}
        setTagsString={setTagsString}
        loading={loading}
        isEditing={isEditing}
        error={error}
        successMessage={successMessage}
        onSubmit={handleSubmit}
        onCancelEdit={handleCancelEdit}
      />
    </div>
  )
}
