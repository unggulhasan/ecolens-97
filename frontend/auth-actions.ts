"use server"

import { redirect } from "next/navigation"
import { auth, signIn, signOut } from "@/auth"
import { getAuthBaseUrl, getCognitoLogoutUrl } from "@/lib/cognito"

import { CognitoIdentityProviderClient, AdminCreateUserCommand } from "@aws-sdk/client-cognito-identity-provider"

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || "ap-southeast-4",
  ...(process.env.AWS_ACCESS_KEY_ID
    ? {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          sessionToken: process.env.AWS_SESSION_TOKEN,
        },
      }
    : {}),
})

function getUserPoolId() {
  const issuer = process.env.AUTH_COGNITO_ISSUER
  if (!issuer) {
    throw new Error("AUTH_COGNITO_ISSUER environment variable is not defined")
  }
  const parts = issuer.split("/")
  return parts[parts.length - 1]
}

export async function signInWithCognito(redirectTo = "/search") {
  await signIn("cognito", { redirectTo })
}

export async function signUpWithCognito(redirectTo = "/search") {
  await signIn("cognito-signup", { redirectTo })
}

export async function signUpWithCognitoAdmin(formData: {
  email: string
  givenName: string
  familyName: string
}) {
  try {
    const userPoolId = getUserPoolId()

    const command = new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: formData.email,
      UserAttributes: [
        { Name: "email", Value: formData.email },
        { Name: "email_verified", Value: "true" },
        { Name: "given_name", Value: formData.givenName },
        { Name: "family_name", Value: formData.familyName },
      ],
      DesiredDeliveryMediums: ["EMAIL"],
    })

    await cognitoClient.send(command)

    return {
      success: true,
      message: "Registration successful! Temporary password sent to email."
    }
  } catch (error: any) {
    console.error("Cognito AdminCreateUser error:", error)
    return {
      success: false,
      message: error.message || "Failed to create user. Please try again."
    }
  }
}

export async function signOutWithCognito() {
  await signOut({ redirect: false })
  redirect(getCognitoLogoutUrl(`${getAuthBaseUrl()}/login`))
}
