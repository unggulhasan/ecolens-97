import { signInWithCognito, signUpWithCognito } from "@/auth-actions"
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

export function LoginFormPanel({ redirectTo = "/dashboard" }: LoginFormPanelProps) {
  return (
    <div className="auth-form-panel">
      <CardHeader className="auth-form-header">
        <CardTitle className="auth-form-title">Login</CardTitle>
        <CardDescription className="auth-form-description">
          Sign in to continue to your dashboard.
        </CardDescription>
      </CardHeader>

      <CardContent className="auth-form-content">
        <FieldGroup className="auth-form-actions">
          <form
            action={async () => {
              "use server"
              await signInWithCognito(redirectTo)
            }}
          >
            <Button type="submit" className="auth-button-full">
              Sign in with Cognito
            </Button>
          </form>

          <form
            action={async () => {
              "use server"
              await signUpWithCognito(redirectTo)
            }}
          >
            <Button type="submit" variant="outline" className="auth-signup-button">
              Create an account
            </Button>
          </form>
        </FieldGroup>
      </CardContent>
    </div>
  )
}
