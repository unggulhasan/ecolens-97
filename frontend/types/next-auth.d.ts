import type { DefaultSession } from "next-auth"
import type { JWT as DefaultJWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session extends DefaultSession {
    accessToken?: string
    idToken?: string
    error?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    accessToken?: string
    idToken?: string
    refreshToken?: string
    expiresAt?: number
    error?: string
  }
}
