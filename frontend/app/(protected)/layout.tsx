import { auth } from "@/auth"
import { signOutWithCognito } from "@/auth-actions"
import { UserDropdown } from "@/components/user-dropdown"

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (session?.error) {
    await signOutWithCognito()
  }

  const user = session?.user || {}

  return (
    <div className="flex min-h-svh flex-col">
      <nav className="top-nav-bar flex items-center justify-between w-full">
        <span className="top-nav-logo">Aussie Ecolens</span>
        <UserDropdown user={user} />
      </nav>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}
