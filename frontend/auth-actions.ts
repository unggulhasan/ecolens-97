"use server"

import { signIn } from "@/auth"

export async function signInWithCognito(redirectTo = "/dashboard") {
  await signIn("cognito", { redirectTo })
}

export async function signUpWithCognito(redirectTo = "/dashboard") {
  await signIn("cognito-signup", { redirectTo })
}
