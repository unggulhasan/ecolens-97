import NextAuth, { type NextAuthConfig } from "next-auth"
import Cognito from "next-auth/providers/cognito"
import type { JWT } from "next-auth/jwt"
import { getCognitoSignUpAuthorizationUrl } from "@/lib/cognito"

const cognitoSignUpAuthorizationUrl =
  process.env.AUTH_COGNITO_DOMAIN && process.env.AUTH_COGNITO_ISSUER
    ? getCognitoSignUpAuthorizationUrl()
    : undefined

const cognitoClientOptions = {
  clientId: process.env.AUTH_COGNITO_ID!,
  issuer: process.env.AUTH_COGNITO_ISSUER!,
  checks: ["pkce", "state"] as ("pkce" | "state")[],
  client: {
    token_endpoint_auth_method: "none" as const,
  },
  authorization: {
    params: {
      scope: "openid profile email",
      response_type: "code",
    },
  },
}

const authConfig = {
  providers: [
    Cognito(cognitoClientOptions),
    Cognito({
      ...cognitoClientOptions,
      id: "cognito-signup",
      authorization: {
        ...cognitoClientOptions.authorization,
        ...(cognitoSignUpAuthorizationUrl
          ? { url: cognitoSignUpAuthorizationUrl }
          : {}),
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
        token.idToken = account.id_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at
      }

      if (Date.now() < (token.expiresAt as number) * 1000) {
        return token
      }

      return await refreshAccessToken(token)
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      session.idToken = token.idToken as string
      session.error = token.error as string | undefined
      return session
    },
  },
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
} satisfies NextAuthConfig

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)

async function refreshAccessToken(token: JWT) {
  try {
    const url = `${process.env.AUTH_COGNITO_ISSUER}/oauth2/token`
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.AUTH_COGNITO_ID!,
        refresh_token: token.refreshToken ?? "",
      }),
    })

    const refreshed = await response.json()
    if (!response.ok) throw refreshed

    return {
      ...token,
      accessToken: refreshed.access_token,
      idToken: refreshed.id_token,
      expiresAt: Math.floor(Date.now() / 1000 + refreshed.expires_in),
    }
  } catch {
    return { ...token, error: "RefreshAccessTokenError" }
  }
}
