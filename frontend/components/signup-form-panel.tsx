"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { signUpWithCognitoAdmin } from "@/auth-actions"
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

const signupSchema = z.object({
  email: z.string().min(1, "Email address is required.").email("Please enter a valid email address."),
  givenName: z.string().min(1, "First name is required."),
  familyName: z.string().min(1, "Last name is required."),
})

type SignupFormValues = z.infer<typeof signupSchema>

export function SignupFormPanel() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      givenName: "",
      familyName: "",
    },
  })

  const onSubmit = async (data: SignupFormValues) => {
    setError(null)
    setLoading(true)

    try {
      const result = await signUpWithCognitoAdmin({
        email: data.email,
        givenName: data.givenName,
        familyName: data.familyName,
      })

      if (result.success) {
        setSuccess(true)
      } else {
        setError(result.message || "Failed to create account. Please try again.")
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    const emailValue = form.getValues("email")
    return (
      <div className="authFormPanel">
        <div className="authSuccessContainer">
          <div className="authSuccessIconWrapper">
            <svg
              className="size-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <CardHeader className="authSuccessHeader px-0 pb-2 flex flex-col items-center text-center w-full">
            <CardTitle className="authSuccessTitle text-xl font-semibold text-center w-full">Check your email</CardTitle>
            <CardDescription className="authSuccessDescription text-sm text-center">
              We have sent a temporary password to <strong className="text-foreground">{emailValue}</strong>. Please check your inbox to sign in.
            </CardDescription>
          </CardHeader>
          <Button asChild className="w-full mt-4">
            <Link href="/login">
              Continue to Sign In
            </Link>
          </Button>
        </div>
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="authFormSpacing">
          {error && (
            <Alert variant="destructive">
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
