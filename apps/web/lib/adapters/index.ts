/**
 * Integration adapters.
 *
 * Stellar adapter calls /api/claims/* so the sponsor secret never reaches the browser.
 */

function apiBase() {
  return process.env.NEXT_PUBLIC_VAIVEM_API_BASE ?? ""
}

async function fundClaim(amount: string, expiresInSeconds?: number) {
  const res = await fetch(`${apiBase()}/api/claims/fund`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount,
      ...(expiresInSeconds != null ? { expiresInSeconds } : {}),
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? "fund failed")
  return data as {
    balanceId: string
    recipientPublicKey: string
    deadline: number
    hash: string
  }
}

export const stellarAdapter = {
  async createSponsoredAccount(): Promise<{ address: string; sponsored: boolean }> {
    const data = await fundClaim("1")
    return { address: data.recipientPublicKey, sponsored: true }
  },
  async sendPayment(balanceId: string): Promise<{ hash: string }> {
    const res = await fetch(`${apiBase()}/api/claims/${encodeURIComponent(balanceId)}/claim`, {
      method: "POST",
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "claim failed")
    return { hash: data.hash as string }
  },
  /** Lock the real USDC amount into a claimable balance. */
  async lockFunds(
    amount: string,
    expiresInSeconds?: number,
  ): Promise<{ hash: string; balanceId: string; deadline: number }> {
    const data = await fundClaim(amount, expiresInSeconds)
    return { hash: data.hash, balanceId: data.balanceId, deadline: data.deadline }
  },
  /** Sponsor reclaim — uses balanceId from the stored claim record. */
  async refundFunds(balanceId: string): Promise<{ hash: string }> {
    const res = await fetch(`${apiBase()}/api/claims/${encodeURIComponent(balanceId)}/refund`, {
      method: "POST",
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "refund failed")
    return { hash: data.hash as string }
  },
  explorerUrl(hash: string): string {
    return `https://stellar.expert/explorer/testnet/tx/${hash}`
  },
}

// ---------------------------------------------------------------------------
// Etherfuse adapter — USDC -> BRL PIX ramp
// ---------------------------------------------------------------------------

export interface EtherfuseQuote {
  quoteId: string
  midMarketRate: string
  nominalRate: string
  effectiveRate: string
  feeBps: string
  feeAmountUsdc: string
  requiresSwap: boolean
}

export const etherfuseAdapter = {
  async getQuote(usdc: number, country: "BR" | "MX" = "BR") {
    const base = process.env.NEXT_PUBLIC_VAIVEM_API_BASE ?? ""
    const res = await fetch(`${base}/api/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: usdc, country }),
    })
    if (!res.ok) throw new Error("quote failed")
    return res.json()
  },

  async createPixOrder(amountUSDC: number): Promise<{ reference: string }> {
    const base = process.env.NEXT_PUBLIC_VAIVEM_API_BASE ?? ""
    const res = await fetch(`${base}/api/payouts/pix`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amountUSDC }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "pix order failed")
    return { reference: data.orderId as string }
  },
}

// ---------------------------------------------------------------------------
// Authentication adapter — email / Google / passkey (mocked)
// ---------------------------------------------------------------------------
export const authAdapter = {
  async signInWithEmail(email: string): Promise<{ ok: true; email: string }> {
    return { ok: true, email }
  },
  async signInWithGoogle(): Promise<{ ok: true }> {
    return { ok: true }
  },
  async signInWithPasskey(): Promise<{ ok: true }> {
    return { ok: true }
  },
  async verifyOtp(code: string): Promise<{ ok: boolean }> {
    return { ok: code.length === 6 && code !== "000000" }
  },
}

// ---------------------------------------------------------------------------
// Supabase adapter — persistence layer (mocked in-memory in the MVP)
// ---------------------------------------------------------------------------
export const supabaseAdapter = {
  async persist<T>(_table: string, record: T): Promise<T> {
    return record
  },
}

export function randomTxHash(): string {
  const chars = "abcdef0123456789"
  return Array.from({ length: 64 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

export function randomStellarAddress(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  return (
    "G" +
    Array.from({ length: 55 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
  )
}

export function randomToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}
