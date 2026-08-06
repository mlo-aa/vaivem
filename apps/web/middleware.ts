import createMiddleware from "next-intl/middleware"
import { NextResponse, type NextRequest } from "next/server"
import {
  AuthSecretError,
  COOKIE_NAME,
  hasAuthSecret,
  verifySessionToken,
} from "@/lib/dashboard-session"
import { detectClaimLocale, isAppLocale, routing } from "@/i18n/routing"

const intlMiddleware = createMiddleware(routing)

function stripLocale(pathname: string): { locale: string | null; path: string } {
  const parts = pathname.split("/")
  const maybe = parts[1]
  if (maybe && isAppLocale(maybe)) {
    const rest = "/" + parts.slice(2).join("/")
    return { locale: maybe, path: rest === "/" ? "/" : rest.replace(/\/$/, "") || "/" }
  }
  return { locale: null, path: pathname }
}

function isProtectedPath(pathWithoutLocale: string): boolean {
  if (pathWithoutLocale === "/dashboard" || pathWithoutLocale.startsWith("/dashboard/")) {
    return true
  }
  if (pathWithoutLocale.startsWith("/api/funding")) return true
  if (pathWithoutLocale.startsWith("/api/claims")) {
    if (pathWithoutLocale.startsWith("/api/claims/by-token/")) return false
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

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // API routes: auth only, no locale prefix
  if (pathname.startsWith("/api/")) {
    if (!isProtectedPath(pathname)) {
      return NextResponse.next()
    }
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Unprefixed /claim/* → detect browser, default pt-BR
  if (pathname === "/claim" || pathname.startsWith("/claim/")) {
    const locale = detectClaimLocale(req.headers.get("accept-language"))
    const url = req.nextUrl.clone()
    url.pathname = `/${locale}${pathname}`
    return NextResponse.redirect(url)
  }

  const intlResponse = intlMiddleware(req)

  const { locale, path } = stripLocale(pathname)
  if (!isProtectedPath(path)) {
    return intlResponse
  }

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
    if (session) return intlResponse
  } catch (err) {
    if (err instanceof AuthSecretError) {
      return misconfiguredResponse(pathname)
    }
    console.error("[middleware]", err)
    return misconfiguredResponse(pathname)
  }

  const loginLocale = locale && isAppLocale(locale) ? locale : "en"
  const login = req.nextUrl.clone()
  login.pathname = `/${loginLocale}/login`
  login.searchParams.set("next", pathname)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
}
