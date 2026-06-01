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

export async function signOutWithCognito() {
  await signOut({ redirect: false })
  redirect(getCognitoLogoutUrl(`${getAuthBaseUrl()}/login`))
}
