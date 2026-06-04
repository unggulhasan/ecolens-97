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
        <CardDescription className="authWelcomeEyebrow text-white">
          {eyebrow}
        </CardDescription>
        <CardTitle className="authWelcomeTitle text-4xl font-extrabold">{title}</CardTitle>
        <CardDescription className="authWelcomeDescription text-white">
          {description}
        </CardDescription>
      </CardHeader>
    </div>
  )
}
