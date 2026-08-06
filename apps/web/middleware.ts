import { NextResponse, type NextRequest } from "next/server"
import {
  COOKIE_NAME,
  dashboardAuthConfigured,
  verifySessionToken,
} from "@/lib/dashboard-auth"

let warnedMissingPassword = false

function isProtectedPath(pathname: string): boolean {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return true
  }
  // All /api/claims* except the public by-token recipient routes.
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

  if (!dashboardAuthConfigured()) {
    if (!warnedMissingPassword) {
      warnedMissingPassword = true
      console.warn(
        "[auth] DASHBOARD_PASSWORD is unset — /dashboard and /api/claims are public. Set it before any shared deploy.",
      )
    }
    return NextResponse.next()
  }

  const token = req.cookies.get(COOKIE_NAME)?.value
  const ok = await verifySessionToken(token)
  if (ok) return NextResponse.next()

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
  ],
}
