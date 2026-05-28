import { auth, signOut } from "@/auth"
import { LogoutButton } from "@/components/logout-button"

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (session?.error) {
    await signOut({ redirectTo: "/login" })
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex justify-end border-b px-4 py-3">
        <LogoutButton />
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}
