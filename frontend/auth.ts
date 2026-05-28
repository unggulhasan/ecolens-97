// auth.ts (root level)
import NextAuth from 'next-auth'
import Cognito from 'next-auth/providers/cognito'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Cognito({
      clientId: process.env.AUTH_COGNITO_ID!,
      issuer: process.env.AUTH_COGNITO_ISSUER!,
      checks: ["pkce", "state"],
      client: {
        token_endpoint_auth_method: "none"
      },
      authorization: {
        params: {
          scope: "openid profile email",
          response_type: "code",
        },
      },
    })
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Store tokens on first sign in
      if (account) {
        token.accessToken = account.access_token
        token.idToken = account.id_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at
        console.log('Initial token set:', token)
      }

      // Return token if not expired
      if (Date.now() < (token.expiresAt as number) * 1000) {
        return token
      }

      // Token expired — refresh it
      return await refreshAccessToken(token)
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      session.idToken = token.idToken as string
      session.error = token.error as string | undefined
      return session
    }
  },
  pages: {
    signIn: '/login',
    error: '/auth/error',
  }
})

// Token refresh helper
async function refreshAccessToken(token: any) {
  try {
    const url = `${process.env.AUTH_COGNITO_ISSUER}/oauth2/token`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.AUTH_COGNITO_ID!,
        client_secret: process.env.AUTH_COGNITO_SECRET!,
        refresh_token: token.refreshToken,
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
  } catch (error) {
    return { ...token, error: 'RefreshAccessTokenError' }
  }
}