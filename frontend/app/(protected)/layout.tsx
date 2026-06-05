import { auth } from "@/auth"
import { signOutWithCognito } from "@/auth-actions"
import { UserDropdown } from "@/components/user-dropdown"
import { NotificationDropdown } from "@/components/notification-dropdown"
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

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
    <TooltipProvider delayDuration={0}>
      <SidebarProvider>
        <div className="flex min-h-svh w-full">
          <AppSidebar />
          <SidebarInset className="flex flex-1 flex-col">
            <nav className="top-nav-bar flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <span className="top-nav-logo">Aussie Ecolens</span>
              </div>
              <div className="flex items-center gap-3">
                <NotificationDropdown />
                <UserDropdown user={user} />
              </div>
            </nav>
            <main className="flex flex-1 flex-col">{children}</main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  )
}
