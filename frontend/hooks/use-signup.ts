import { useState, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { signUpWithCognitoAdmin } from "@/lib/auth-actions"

export const signupSchema = z.object({
  email: z.string().min(1, "Email address is required.").email("Please enter a valid email address."),
  givenName: z.string().min(1, "First name is required."),
  familyName: z.string().min(1, "Last name is required."),
})

export type SignupFormValues = z.infer<typeof signupSchema>

export function useSignup() {
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

  const onSubmit = useCallback(async (data: SignupFormValues) => {
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
  }, [])

  return {
    form,
    loading,
    error,
    success,
    onSubmit: form.handleSubmit(onSubmit),
  }
}
