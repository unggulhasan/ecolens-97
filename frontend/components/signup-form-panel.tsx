"use client"

import React, { useState } from "react"
import Link from "next/link"
import { signUpWithCognitoAdmin } from "@/auth-actions"
import { Button } from "@/components/ui/button"
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function SignupFormPanel() {
  const [email, setEmail] = useState("")
  const [givenName, setGivenName] = useState("")
  const [familyName, setFamilyName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await signUpWithCognitoAdmin({
        email,
        givenName,
        familyName,
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
    return (
      <div className="auth-form-panel">
        <div className="auth-success-container">
          <div className="auth-success-icon-wrapper">
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
          <CardHeader className="auth-success-header">
            <CardTitle className="auth-success-title">Check your email</CardTitle>
            <CardDescription className="auth-success-description">
              We have sent a temporary password to <strong className="text-foreground">{email}</strong>. Please check your inbox to sign in.
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
    <div className="auth-form-panel">
      <CardHeader className="auth-form-header">
        <CardTitle className="auth-form-title">Create Account</CardTitle>
        <CardDescription className="auth-form-description">
          Sign up to register a new account.
        </CardDescription>
      </CardHeader>

      <CardContent className="auth-form-content">
        <form onSubmit={handleSubmit} className="auth-form-spacing">
          {error && (
            <div className="auth-error-alert">
              {error}
            </div>
          )}

          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="signup-email">Email Address</FieldLabel>
              <Input
                id="signup-email"
                type="email"
                placeholder="name@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </Field>

            <div className="auth-form-grid-2">
              <Field>
                <FieldLabel htmlFor="signup-firstname">First Name</FieldLabel>
                <Input
                  id="signup-firstname"
                  type="text"
                  placeholder="John"
                  required
                  value={givenName}
                  onChange={(e) => setGivenName(e.target.value)}
                  disabled={loading}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="signup-lastname">Last Name</FieldLabel>
                <Input
                  id="signup-lastname"
                  type="text"
                  placeholder="Doe"
                  required
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  disabled={loading}
                />
              </Field>
            </div>

            <Button type="submit" className="auth-button-full mt-2" disabled={loading}>
              {loading ? "Creating account..." : "Sign Up"}
            </Button>

            <Button asChild variant="outline" className="auth-signup-button" disabled={loading}>
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
