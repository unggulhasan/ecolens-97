import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type AuthWelcomePanelProps = {
  eyebrow?: string
  title?: string
  description?: string
}

export function AuthWelcomePanel({
  eyebrow = "Welcome to",
  title = "Aussie Ecolens",
  description = "Explore and share Australian wildlife through your lens.",
}: AuthWelcomePanelProps) {
  return (
    <div className="auth-welcome-panel">
      <CardHeader className="auth-welcome-header">
        <CardDescription className="auth-welcome-eyebrow">
          {eyebrow}
        </CardDescription>
        <CardTitle className="auth-welcome-title">{title}</CardTitle>
        <CardDescription className="auth-welcome-description">
          {description}
        </CardDescription>
      </CardHeader>
    </div>
  )
}
