import { NextResponse } from "next/server"
import { auth } from "@/auth"

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl

  if (pathname === "/login" && req.auth) {
    return NextResponse.redirect(new URL("/", req.url))
  }

  if (!req.auth && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*"],
}
