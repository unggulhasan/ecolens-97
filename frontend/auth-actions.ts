"use server"

import { redirect } from "next/navigation"
import { signIn, signOut } from "@/auth"
import { getAuthBaseUrl, getCognitoLogoutUrl } from "@/lib/cognito"

export async function signInWithCognito(redirectTo = "/dashboard") {
  await signIn("cognito", { redirectTo })
}

export async function signUpWithCognito(redirectTo = "/dashboard") {
  await signIn("cognito-signup", { redirectTo })
}

export async function signUpWithCognitoAdmin(formData: {
  email: string
  givenName: string
  familyName: string
}) {
  // Mock delay
  await new Promise((resolve) => setTimeout(resolve, 1000))
  
  console.log("Mock Cognito AdminCreateUser called with:", formData)
  
  // Return mock success
  return {
    success: true,
    message: "Registration successful! Temporary password sent to email."
  }
}

export async function signOutWithCognito() {
  await signOut({ redirect: false })
  redirect(getCognitoLogoutUrl(`${getAuthBaseUrl()}/login`))
}
