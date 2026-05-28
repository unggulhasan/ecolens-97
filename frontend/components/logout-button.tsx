import { signOut } from "@/auth"
import { Button } from "@/components/ui/button"

export function LogoutButton() {
  return (
    <form
      action={async () => {
        "use server"
        await signOut({ redirectTo: "/login" })
      }}
    >
      <Button type="submit" variant="outline" size="sm">
        Log out
      </Button>
    </form>
  )
}
