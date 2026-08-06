import { NextResponse, type NextRequest } from "next/server"
import {
  AuthSecretError,
  COOKIE_NAME,
  hasAuthSecret,
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

function misconfiguredResponse(pathname: string) {
  const message =
    "AUTH_SECRET is not set on this deployment. Add it in Vercel → Project Settings → Environment Variables (Production and Preview), then redeploy."
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "auth_misconfigured", message },
      { status: 503 },
    )
  }
  return new NextResponse(message, {
    status: 503,
    headers: { "content-type": "text/plain; charset=utf-8" },
  })
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (!isProtectedPath(pathname)) {
    return NextResponse.next()
  }

  // Vercel Edge: missing AUTH_SECRET used to throw → MIDDLEWARE_INVOCATION_FAILED.
  if (
    !hasAuthSecret() &&
    (process.env.NODE_ENV === "production" ||
      process.env.VERCEL === "1" ||
      Boolean(process.env.VERCEL_ENV))
  ) {
    return misconfiguredResponse(pathname)
  }

  try {
    const token = req.cookies.get(COOKIE_NAME)?.value
    const session = await verifySessionToken(token)
    if (session) return NextResponse.next()
  } catch (err) {
    if (err instanceof AuthSecretError) {
      return misconfiguredResponse(pathname)
    }
    console.error("[middleware]", err)
    return misconfiguredResponse(pathname)
  }

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
