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
    <div className="authWelcomePanel">
      <CardHeader className="authWelcomeHeader">
        <CardDescription className="authWelcomeEyebrow">
          {eyebrow}
        </CardDescription>
        <CardTitle className="authWelcomeTitle">{title}</CardTitle>
        <CardDescription className="authWelcomeDescription">
          {description}
        </CardDescription>
      </CardHeader>
    </div>
  )
}
