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
export const stellarAdapter = {
  // TODO(stellar): use @stellar/stellar-sdk Horizon/RPC + a funding keypair.
  async createSponsoredAccount(): Promise<{ address: string; sponsored: boolean }> {
    // Real impl: build a sponsored createAccount + changeTrust(USDC) tx.
    return {
      address: randomStellarAddress(),
      sponsored: true,
    }
  },
  async sendPayment(): Promise<{ hash: string }> {
    // Real impl: submit a Payment operation and poll for confirmation.
    return { hash: randomTxHash() }
  },
  async lockFunds(): Promise<{ hash: string }> {
    // Real impl: move funds into a claimable balance / escrow account.
    return { hash: randomTxHash() }
  },
  explorerUrl(hash: string): string {
    // Real impl: point at mainnet. Testnet used here for the demo.
    return `https://stellar.expert/explorer/testnet/tx/${hash}`
  },
}

// ---------------------------------------------------------------------------
// Manteca adapter — LATAM ramp / PIX settlement provider
// ---------------------------------------------------------------------------
export const mantecaAdapter = {
  // TODO(manteca): call Manteca's quote + order endpoints with API credentials.
  async getPixQuote(usdc: number): Promise<{ rate: number; fee: number; brl: number }> {
    const rate = 5.045 - Math.random() * 0.03
    const gross = usdc * rate
    const fee = Math.round(gross * 0.014 * 100) / 100
    return { rate: Math.round(rate * 1000) / 1000, fee, brl: Math.round((gross - fee) * 100) / 100 }
  },
  async createPixOrder(): Promise<{ reference: string }> {
    return { reference: `pix_${randomId(6).toUpperCase()}` }
  },
}

// ---------------------------------------------------------------------------
// Etherfuse adapter — alternative stablecoin ramp / yield rails
// ---------------------------------------------------------------------------
export const etherfuseAdapter = {
  // TODO(etherfuse): integrate Etherfuse ramp endpoints as a fallback provider.
  async getQuote(usdc: number): Promise<{ rate: number; fee: number }> {
    return { rate: 5.03, fee: Math.round(usdc * 0.012 * 100) / 100 }
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
