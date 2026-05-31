import { AuthWelcomePanel } from "@/components/auth-welcome-panel"
import { LoginFormPanel } from "@/components/login-form-panel"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

type AuthSplitCardProps = {
  redirectTo?: string
}

export function AuthSplitCard({ redirectTo }: AuthSplitCardProps) {
  return (
    <Card className="auth-card">
      <div className="auth-card-grid">
        <AuthWelcomePanel />
        <Separator
          orientation="vertical"
          className="auth-separator auth-separator-vertical"
        />
        <Separator className="auth-separator auth-separator-horizontal" />
        <LoginFormPanel redirectTo={redirectTo} />
      </div>
    </Card>
  )
}
