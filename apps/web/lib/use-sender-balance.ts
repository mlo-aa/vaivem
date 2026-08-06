'use client'

import { useCallback, useEffect, useState } from 'react'

/** Shared sender ledger balance for nav / empty states / redirects. */
export function useSenderBalance() {
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/funding/balance')
      if (!res.ok) {
        setBalance(null)
        return null
      }
      const data = await res.json()
      const amount = Number(data.amount ?? 0)
      setBalance(amount)
      return amount
    } catch {
      setBalance(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { balance, loading, refresh, funded: (balance ?? 0) > 0 }
}

export const CUSTODY_LINE =
  'Demo ledger on a shared sponsor wallet — not segregated custody.'
