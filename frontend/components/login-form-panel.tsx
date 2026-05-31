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
    <div className="flex h-full flex-col justify-center p-8 md:p-10">
      <CardHeader className="px-0">
        <CardTitle className="text-2xl text-gray-800">Login</CardTitle>
        <CardDescription className="text-gray-600">
          Sign in to continue to your dashboard.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-0 pt-6">
        <FieldGroup>
          <form
            action={async () => {
              "use server"
              await signIn("cognito", { redirectTo })
            }}
          >
            <Button type="submit" className="w-full">
              Sign in with Cognito
            </Button>
          </form>
        </FieldGroup>
      </CardContent>
    </div>
  )
}
