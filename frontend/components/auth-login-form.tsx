"use client"

import Link from "next/link"
import { signInWithCognito } from "@/lib/auth-actions"
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

export function LoginFormPanel({ redirectTo = "/home" }: LoginFormPanelProps) {
  return (
    <div className="authFormPanel">
      <CardHeader className="authFormHeader px-0 pb-4">
        <CardTitle className="authFormTitle text-2xl font-semibold">Login</CardTitle>
        <CardDescription className="authFormDescription">
          Sign in to continue.
        </CardDescription>
      </CardHeader>

      <CardContent className="authFormContent px-0 pt-6">
        <FieldGroup className="authFormActions">
          <form
            action={() => {
              signInWithCognito(redirectTo)
            }}
          >
            <Button type="submit" className="authButtonFull w-full">
              Sign in with Cognito
            </Button>
          </form>

          <Button asChild variant="outline" className="authSignupButton w-full">
            <Link href="/signup">
              Create an account
            </Link>
          </Button>
        </FieldGroup>
      </CardContent>
    </div>
  )
}
