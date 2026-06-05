import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HugeiconsIcon } from "@hugeicons/react"
import { Mail01Icon } from "@hugeicons/core-free-icons"

type SignupSuccessPanelProps = {
  email: string
}

export function SignupSuccessPanel({ email }: SignupSuccessPanelProps) {
  return (
    <div className="authSuccessContainer">
      <div className="authSuccessIconWrapper bg-primary/10 text-primary p-3 rounded-full mb-4">
        <HugeiconsIcon
          icon={Mail01Icon}
          className="size-8"
          strokeWidth={2}
        />
      </div>
      <CardHeader className="authSuccessHeader px-0 pb-2 flex flex-col items-center text-center w-full">
        <CardTitle className="authSuccessTitle text-xl font-semibold text-center w-full">Check your email</CardTitle>
        <CardDescription className="authSuccessDescription text-sm text-center">
          We have sent a temporary password to <strong className="text-foreground">{email}</strong>. Please check your inbox to sign in.
        </CardDescription>
      </CardHeader>
      <Button asChild className="w-full mt-4">
        <Link href="/login">
          Continue to Sign In
        </Link>
      </Button>
    </div>
  )
}
