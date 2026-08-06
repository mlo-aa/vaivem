import { NextResponse, type NextRequest } from "next/server"
import {
  COOKIE_NAME,
  verifySessionToken,
} from "@/lib/dashboard-session"

function isProtectedPath(pathname: string): boolean {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return true
  }
  if (pathname.startsWith("/api/funding")) {
    return true
  }
  if (pathname.startsWith("/api/claims")) {
    if (pathname.startsWith("/api/claims/by-token/")) return false
    return true
  }
  return false
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (!isProtectedPath(pathname)) {
    return NextResponse.next()
  }

  const token = req.cookies.get(COOKIE_NAME)?.value
  const session = await verifySessionToken(token)
  if (session) return NextResponse.next()

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const login = req.nextUrl.clone()
  login.pathname = "/login"
  login.searchParams.set("next", pathname)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/api/claims",
    "/api/claims/:path*",
    "/api/funding",
    "/api/funding/:path*",
  ],
}
