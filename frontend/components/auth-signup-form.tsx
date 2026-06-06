"use client"

import * as React from "react"
import Link from "next/link"
import { Controller } from "react-hook-form"
import { useSignup } from "@/hooks/use-signup"
import { Button } from "@/components/ui/button"
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel, FieldGroup, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { SignupSuccessPanel } from "@/components/auth-signup-success"

export function SignupFormPanel() {
  const { form, loading, error, success, onSubmit } = useSignup()

  if (success) {
    const emailValue = form.getValues("email")
    return (
      <div className="authFormPanel">
        <SignupSuccessPanel email={emailValue} />
      </div>
    )
  }

  return (
    <div className="authFormPanel">
      <CardHeader className="authFormHeader px-0 pb-4">
        <CardTitle className="authFormTitle text-2xl font-semibold">Create Account</CardTitle>
        <CardDescription className="authFormDescription">
          Sign up to register a new account.
        </CardDescription>
      </CardHeader>

      <CardContent className="authFormContent px-0 pt-6">
        <form onSubmit={onSubmit} className="authFormSpacing">
          {error && (
            <Alert variant="destructive" className="flex items-start gap-2.5">
              <svg
                className="size-4 shrink-0 text-current translate-y-0.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <FieldGroup className="gap-4">
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="signup-email">Email Address</FieldLabel>
                  <Input
                    {...field}
                    id="signup-email"
                    type="email"
                    placeholder="name@example.com"
                    required
                    disabled={loading}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <div className="authFormGrid2">
              <Controller
                name="givenName"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="signup-firstname">First Name</FieldLabel>
                    <Input
                      {...field}
                      id="signup-firstname"
                      type="text"
                      placeholder="John"
                      required
                      disabled={loading}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="familyName"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="signup-lastname">Last Name</FieldLabel>
                    <Input
                      {...field}
                      id="signup-lastname"
                      type="text"
                      placeholder="Doe"
                      required
                      disabled={loading}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>

            <Button type="submit" className="authButtonFull w-full mt-2" disabled={loading}>
              {loading ? "Creating account..." : "Sign Up"}
            </Button>

            <Button asChild variant="outline" className="authSignupButton w-full" disabled={loading}>
              <Link href="/login">
                Already have an account? Sign In
              </Link>
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </div>
  )
}
