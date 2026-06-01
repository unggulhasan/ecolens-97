import { NextResponse } from "next/server"
import { auth } from "@/auth"

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth
  const hasError = isLoggedIn && !!(req.auth as { error?: string }).error

  if ((pathname === "/login" || pathname === "/signup") && isLoggedIn && !hasError && req.method !== "POST") {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  if ((!isLoggedIn || hasError) && pathname !== "/login" && pathname !== "/signup") {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/", "/login", "/signup", "/dashboard/:path*"],
}
