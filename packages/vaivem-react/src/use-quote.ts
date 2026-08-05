"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchQuote } from "./api"
import type { Quote } from "./types"

export type UseQuoteOptions = {
  apiBaseUrl?: string
  /** When false, the hook does not auto-fetch. Default true. */
  enabled?: boolean
}

/**
 * Live Etherfuse quote + 2-minute countdown.
 * All fetches go to `{apiBaseUrl}/api/quote` (default "" = same origin).
 */
export function useQuote(
  amount: number,
  country: "BR" | "MX" = "BR",
  options: UseQuoteOptions = {},
) {
  const apiBaseUrl = options.apiBaseUrl ?? ""
  const enabled = options.enabled ?? true

  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)

  const refresh = useCallback(async () => {
    if (!Number.isFinite(amount) || amount <= 0) return
    setLoading(true)
    try {
      const q = await fetchQuote(amount, country, apiBaseUrl)
      setQuote(q)
      setError(null)
    } catch {
      setError("Couldn't refresh the quote. Try again.")
    } finally {
      setLoading(false)
    }
  }, [amount, country, apiBaseUrl])

  useEffect(() => {
    if (!enabled) return
    void refresh()
  }, [enabled, refresh])

  useEffect(() => {
    if (!quote || !enabled) return
    const tick = () => {
      const diff = new Date(quote.expiresAt).getTime() - Date.now()
      const s = Math.max(0, Math.floor(diff / 1000))
      setSecondsLeft(s)
      if (s <= 0 && !loading) void refresh()
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [quote, enabled, loading, refresh])

  return { quote, loading, error, refresh, secondsLeft, setError }
}
