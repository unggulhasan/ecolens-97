"use client"

import Link from "next/link"
import { signInWithCognito } from "@/auth-actions"
import { Button } from "@/components/ui/button"
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FieldGroup } from "@/components/ui/field"

type LoginFormPanelProps = {
  redirectTo?: string
}

export function LoginFormPanel({ redirectTo = "/search" }: LoginFormPanelProps) {
  return (
    <div className="auth-form-panel">
      <CardHeader className="auth-form-header">
        <CardTitle className="auth-form-title">Login</CardTitle>
        <CardDescription className="auth-form-description">
          Sign in to continue.
        </CardDescription>
      </CardHeader>

      <CardContent className="auth-form-content">
        <FieldGroup className="auth-form-actions">
          <form
            action={() => {
              signInWithCognito(redirectTo)
            }}
          >
            <Button type="submit" className="auth-button-full">
              Sign in with Cognito
            </Button>
          </form>

          <Button asChild variant="outline" className="auth-signup-button">
            <Link href="/signup">
              Create an account
            </Link>
          </Button>
        </FieldGroup>
      </CardContent>
    </div>
  )
}
