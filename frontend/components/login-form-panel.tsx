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
    <div className="authFormPanel">
      <CardHeader className="authFormHeader">
        <CardTitle className="authFormTitle">Login</CardTitle>
        <CardDescription className="authFormDescription">
          Sign in to continue.
        </CardDescription>
      </CardHeader>

      <CardContent className="authFormContent">
        <FieldGroup className="authFormActions">
          <form
            action={() => {
              signInWithCognito(redirectTo)
            }}
          >
            <Button type="submit" className="authButtonFull">
              Sign in with Cognito
            </Button>
          </form>

          <Button asChild variant="outline" className="authSignupButton">
            <Link href="/signup">
              Create an account
            </Link>
          </Button>
        </FieldGroup>
      </CardContent>
    </div>
  )
}
