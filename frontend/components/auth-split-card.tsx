import { AuthWelcomePanel } from "@/components/auth-welcome-panel"
import { LoginFormPanel } from "@/components/login-form-panel"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

type AuthSplitCardProps = {
  redirectTo?: string
}

export function AuthSplitCard({ redirectTo }: AuthSplitCardProps) {
  return (
    <Card className="w-full max-w-4xl gap-0 overflow-hidden bg-white p-0 text-gray-800 shadow-lg dark:bg-white dark:text-gray-800 md:aspect-[5/3]">
      <div className="flex min-h-112 flex-1 flex-col md:grid md:h-full md:min-h-0 md:grid-cols-[1fr_1px_1fr]">
        <AuthWelcomePanel />
        <Separator orientation="vertical" className="hidden bg-gray-200 md:block" />
        <Separator className="md:hidden" />
        <LoginFormPanel redirectTo={redirectTo} />
      </div>
    </Card>
  )
}
