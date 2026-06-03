import { auth } from "@/auth"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { fetchHello } from "@/lib/api"

import { SearchContainer } from "@/components/search-container"

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
        <SearchContainer />
      </div>
    </div>
  )
}
