"use server"

import { auth } from "@/auth"

export async function subscribeToTag(email: string, tags: string[]) {
  const session = await auth()
  if (!session?.idToken) {
    throw new Error("Unauthorized: No session token found")
  }

  const apiBaseUrl = process.env.API_BASE_URL
  if (!apiBaseUrl) {
    throw new Error("API_BASE_URL environment variable is not defined")
  }

  const response = await fetch(`${apiBaseUrl}/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.idToken}`,
    },
    body: JSON.stringify({
      email,
      tags,
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || "Failed to process subscription")
  }

  return data as {
    message: string
    status: "pending" | "verified"
    subscription_arn: string
  }
}

export async function getSubscriptionStatus(email: string) {
  const session = await auth()
  if (!session?.idToken) {
    throw new Error("Unauthorized: No session token found")
  }

  const apiBaseUrl = process.env.API_BASE_URL
  if (!apiBaseUrl) {
    throw new Error("API_BASE_URL environment variable is not defined")
  }

  const response = await fetch(`${apiBaseUrl}/subscribe?email=${encodeURIComponent(email)}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${session.idToken}`,
    },
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || "Failed to fetch subscription status")
  }

  return data as {
    status: "verified" | "pending" | "not_subscribed"
    email: string
    tags: string[]
    subscription_arn?: string
  }
}
