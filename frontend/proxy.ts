import { NextResponse } from "next/server"
import { auth } from "@/auth"

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth
  const hasError = isLoggedIn && !!(req.auth as { error?: string }).error

  if (pathname === "/login" && isLoggedIn && !hasError) {
    return NextResponse.redirect(new URL("/", req.url))
  }

  if ((!isLoggedIn || hasError) && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*"],
}
