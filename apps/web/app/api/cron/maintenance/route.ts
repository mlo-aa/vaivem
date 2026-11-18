/**
 * GET /api/cron/maintenance — invoked by Vercel Cron (see vercel.json).
 * Vercel sends `Authorization: Bearer $CRON_SECRET`; without CRON_SECRET set the
 * route refuses to run, so it can never be triggered anonymously.
 */

import { NextResponse } from "next/server"
import { runMaintenance } from "@/lib/server/maintenance"
import { safeEqual } from "@/lib/server/rate-limit"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: "cron_misconfigured", message: "CRON_SECRET is not set" },
      { status: 503 },
    )
  }
  const header = req.headers.get("authorization") ?? ""
  if (!safeEqual(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const report = await runMaintenance()
    return NextResponse.json({ ok: true, ...report })
  } catch (err) {
    console.error("[cron/maintenance]", err instanceof Error ? err.message : err)
    return NextResponse.json({ error: "maintenance_failed" }, { status: 500 })
  }
}
