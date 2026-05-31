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
    <div className="flex h-full min-h-48 flex-col justify-center bg-gradient-to-br from-brand-from via-brand-via to-brand-to p-8 text-white md:min-h-0 md:p-10">
      <CardHeader className="gap-4 px-0">
        <CardDescription className="text-xs font-medium tracking-wide text-gray-300 uppercase">
          {eyebrow}
        </CardDescription>
        <CardTitle className="text-3xl font-semibold text-white">
          {title}
        </CardTitle>
        <CardDescription className="text-base text-gray-300 normal-case tracking-normal">
          {description}
        </CardDescription>
      </CardHeader>
    </div>
  )
}
