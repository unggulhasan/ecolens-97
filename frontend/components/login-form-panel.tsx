import { signIn } from "@/auth"
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
        <FieldGroup>
          <form
            action={async () => {
              "use server"
              await signIn("cognito", { redirectTo })
            }}
          >
            <Button type="submit" className="auth-button-full">
              Sign in with Cognito
            </Button>
          </form>
        </FieldGroup>
      </CardContent>
    </div>
  )
}
