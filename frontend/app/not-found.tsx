import Link from "next/link"
import { auth } from "@/auth"
import { Button } from "@/components/ui/button"

export default async function NotFound() {
  const session = await auth()
  const isLoggedIn = !!session

  const targetPath = isLoggedIn ? "/dashboard" : "/login"
  const buttonLabel = isLoggedIn ? "Back to Dashboard" : "Back to Sign In"

  return (
    <div className="not-found-page">
      <div className="not-found-card">
        <h1 className="not-found-code">404</h1>
        <h2 className="not-found-title">Page Not Found</h2>
        <p className="not-found-description">
          The page you are looking for does not exist or has been moved.
        </p>
        <Button asChild className="not-found-button">
          <Link href={targetPath}>
            {buttonLabel}
          </Link>
        </Button>
      </div>
    </div>
  )
}
