import { auth } from "@/auth"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { fetchHello } from "@/lib/api"

export default async function DashboardPage() {
  const session = await auth()

  let helloMessage: string | null = null
  let helloError: string | null = null

  if (session?.idToken) {
    try {
      const data = await fetchHello(session.idToken)
      helloMessage = data.message
    } catch (error) {
      helloError =
        error instanceof Error ? error.message : "Failed to reach hello API"
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>Your account overview and quick actions.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle>API /hello</CardTitle>
              <CardDescription>
                Authenticated response from API Gateway
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm">
              {helloMessage ? (
                <p className="font-mono text-foreground">{helloMessage}</p>
              ) : (
                <p className="text-destructive">
                  {helloError ?? "No response yet."}
                </p>
              )}
            </CardContent>
          </Card>
          <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
            <Card size="sm">
              <CardHeader>
                <CardTitle>Total Scans</CardTitle>
              </CardHeader>
              <CardContent>124</CardContent>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardTitle>Saved Reports</CardTitle>
              </CardHeader>
              <CardContent>18</CardContent>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardTitle>Alerts</CardTitle>
              </CardHeader>
              <CardContent>3 active</CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
