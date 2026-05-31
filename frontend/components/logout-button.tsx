import { signOutWithCognito } from "@/auth-actions"
import { Button } from "@/components/ui/button"

export function LogoutButton() {
  return (
    <form
      action={async () => {
        "use server"
        await signOutWithCognito()
      }}
    >
      <Button type="submit" variant="outline" size="sm">
        Log out
      </Button>
    </form>
  )
}
