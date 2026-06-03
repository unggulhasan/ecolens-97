import { auth } from "@/auth"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { fetchHello } from "@/lib/api"

export default async function SearchPage() {
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
    <div className="page-container">
      <div className="page-content-wrapper">
        <div className="page-header">
          <h1 className="page-title">Search</h1>
          <p className="page-description">You can search files here.</p>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-main-content">
            <Card>
              <CardHeader>
                <CardTitle>API /hello</CardTitle>
                <CardDescription>
                  Authenticated response from API Gateway
                </CardDescription>
              </CardHeader>
              <CardContent>
                {helloMessage ? (
                  <p className="font-mono text-sm bg-muted/30 p-4 rounded-lg border">{helloMessage}</p>
                ) : (
                  <p className="text-sm text-destructive">
                    {helloError ?? "No response yet."}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="dashboard-stats-sidebar">
            <Card size="sm">
              <CardHeader>
                <CardDescription>Total Scans</CardDescription>
                <CardTitle className="text-3xl font-bold">124</CardTitle>
              </CardHeader>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardDescription>Saved Reports</CardDescription>
                <CardTitle className="text-3xl font-bold">18</CardTitle>
              </CardHeader>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardDescription>Alerts</CardDescription>
                <CardTitle className="text-3xl font-bold text-destructive">3 active</CardTitle>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
