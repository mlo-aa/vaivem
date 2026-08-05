/**
 * Integration adapters.
 *
 * Each adapter exposes the surface the app depends on. In the MVP every method
 * returns simulated data. To go live, replace the bodies with real SDK calls —
 * the function signatures are intentionally stable so no UI has to change.
 */

// ---------------------------------------------------------------------------
// Stellar adapter — account creation, sponsored reserves, trustlines, transfers
// ---------------------------------------------------------------------------
//
// Calls /api/claims/* so the sponsor secret never reaches the browser.
// Tracks the last funded balanceId so claim/refund work without changing
// call-site signatures (services still call lockFunds / sendPayment bare).

let lastBalanceId: string | null = null

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
  lastBalanceId = data.balanceId as string
  return data as {
    balanceId: string
    recipientPublicKey: string
    deadline: number
    hash: string
  }
}

export const stellarAdapter = {
  async createSponsoredAccount(): Promise<{ address: string; sponsored: boolean }> {
    // Fund creates the sponsored account + claimable balance in one flow.
    const data = await fundClaim("1")
    return { address: data.recipientPublicKey, sponsored: true }
  },
  async sendPayment(): Promise<{ hash: string }> {
    // Recipient claim via fee-bump (0 XLM account).
    if (!lastBalanceId) throw new Error("No funded claimable balance to claim")
    const res = await fetch(`${apiBase()}/api/claims/${encodeURIComponent(lastBalanceId)}/claim`, {
      method: "POST",
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "claim failed")
    lastBalanceId = null
    return { hash: data.hash as string }
  },
  async lockFunds(): Promise<{ hash: string }> {
    const data = await fundClaim("10")
    return { hash: data.hash }
  },
  /** Sponsor reclaim after the claim window expires. */
  async refundFunds(): Promise<{ hash: string }> {
    if (!lastBalanceId) throw new Error("No funded claimable balance to refund")
    const res = await fetch(`${apiBase()}/api/claims/${encodeURIComponent(lastBalanceId)}/refund`, {
      method: "POST",
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "refund failed")
    lastBalanceId = null
    return { hash: data.hash as string }
  },
  explorerUrl(hash: string): string {
    return `https://stellar.expert/explorer/testnet/tx/${hash}`
  },
}

// ---------------------------------------------------------------------------
// Etherfuse adapter — USDC -> BRL PIX ramp (primary settlement provider)
// ---------------------------------------------------------------------------
//
// Etherfuse quotes are returned as decimal strings to preserve precision, and
// the provider fee is charged in the SOURCE asset (USDC), not in fiat.
export interface EtherfuseQuote {
  quoteId: string
  midMarketRate: string // Etherfuse reference USD/BRL
  nominalRate: string // rate before fee
  effectiveRate: string // rate after the fee is applied
  feeBps: string
  feeAmountUsdc: string
  requiresSwap: boolean
}

export const etherfuseAdapter = {
  // Cotización real vía /api/quote. La API key vive en el servidor.
  // La fee es de 20 bps sobre el nocional en USDC; el BRL sale del USDC neto.
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

  // TODO(etherfuse): crear la orden real de off-ramp con useAnchor: true.
  async createPixOrder(): Promise<{ reference: string }> {
    return { reference: `pix_${randomId(6).toUpperCase()}` }
  },
}

// ---------------------------------------------------------------------------
// Authentication adapter — email / Google / passkey (mocked)
// ---------------------------------------------------------------------------
export const authAdapter = {
  // TODO(auth): swap for Supabase Auth / WebAuthn / OAuth.
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
    // Demo code accepts any 6 digits, but rejects "000000".
    return { ok: code.length === 6 && code !== '000000' }
  },
}

// ---------------------------------------------------------------------------
// Supabase adapter — persistence layer (mocked in-memory in the MVP)
// ---------------------------------------------------------------------------
export const supabaseAdapter = {
  // TODO(supabase): replace with a typed Supabase client and RLS-guarded queries.
  async persist<T>(_table: string, record: T): Promise<T> {
    return record
  },
}

// --- helpers ----------------------------------------------------------------
function randomId(len: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function randomTxHash(): string {
  const chars = 'abcdef0123456789'
  return Array.from({ length: 64 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function randomStellarAddress(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  return 'G' + Array.from({ length: 55 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function randomToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
