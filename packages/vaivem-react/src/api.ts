import { isBelowMinimum, minAmountMessage } from "./limits"
import type { Quote } from "./types"

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/$/, "")
  return `${b}${path}`
}

/**
 * `invalid` — the request itself is wrong (below the minimum, unsupported country).
 * `provider` — the quote provider is failing (5xx).
 * `network` — the quote service was unreachable.
 */
export type QuoteErrorKind = "invalid" | "provider" | "network"

export class QuoteError extends Error {
  constructor(
    readonly kind: QuoteErrorKind,
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "QuoteError"
  }
}

/** POST {apiBaseUrl}/api/quote — never hardcodes an origin. */
export async function fetchQuote(
  amount: number,
  country: "BR" | "MX",
  apiBaseUrl: string,
): Promise<Quote> {
  if (isBelowMinimum(amount)) {
    throw new QuoteError("invalid", 422, minAmountMessage(country))
  }

  let res: Response
  try {
    res = await fetch(joinUrl(apiBaseUrl, "/api/quote"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, country }),
    })
  } catch {
    throw new QuoteError(
      "network",
      0,
      "We couldn't reach the quote service. Check your connection and try again.",
    )
  }

  let data: { error?: string; message?: string } | null = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    const message =
      data?.message ?? data?.error ?? `The quote provider returned an error (${res.status}).`
    // 424 FailedToGetQuote above the minimum is a corridor outage — keep retrying.
    const kind: QuoteErrorKind =
      data?.error === "amount_below_minimum" || res.status === 422
        ? "invalid"
        : res.status === 424 || data?.error === "provider_rejected"
          ? "provider"
          : res.status >= 400 && res.status < 500
            ? "invalid"
            : "provider"
    throw new QuoteError(kind, res.status, message)
  }

  return data as unknown as Quote
}

/** Lightweight KYC mock (same rules as the Vaivém demo). */
export async function submitKyc(
  input: { fullName: string; taxId: string; dateOfBirth: string },
  onStep?: (step: number) => void,
): Promise<{ status: "approved" | "rejected" }> {
  for (let i = 1; i <= 3; i++) {
    await new Promise((r) => setTimeout(r, 500))
    onStep?.(i)
  }
  const digits = input.taxId.replace(/\D/g, "")
  const valid = (digits.length === 11 || digits.length === 14) && !/^0+$/.test(digits)
  return { status: valid ? "approved" : "rejected" }
}

export type PayoutFailureCode =
  | "already_claimed"
  | "expired"
  | "anchor_rejected"
  | "insufficient_balance"
  | "stuck_funded"
  | "payout_failed"
  | "network"

export class PayoutError extends Error {
  constructor(
    readonly code: PayoutFailureCode,
    message: string,
    readonly meta: { txHash?: string; orderId?: string } = {},
  ) {
    super(message)
    this.name = "PayoutError"
  }
}

export type PixPayoutResult = {
  orderId: string
  txHash: string
  status: string
  source?: "live" | "mock"
}

function classifyHttpError(status: number, body: { error?: string; message?: string; note?: string }): PayoutError {
  const raw = (body.message ?? body.error ?? body.note ?? "Payout failed").toString()
  const lower = raw.toLowerCase()
  if (status === 409 || lower.includes("already")) {
    return new PayoutError("already_claimed", raw)
  }
  if (status === 410 || lower.includes("expir")) {
    return new PayoutError("expired", raw)
  }
  if (lower.includes("insufficient") || lower.includes("underfunded")) {
    return new PayoutError("insufficient_balance", raw)
  }
  if (lower.includes("anchor") || lower.includes("trustline") || lower.includes("compliant")) {
    return new PayoutError("anchor_rejected", raw)
  }
  if (lower.includes("stuck") || lower.includes("funded")) {
    return new PayoutError("stuck_funded", raw)
  }
  if (status >= 500) {
    return new PayoutError("payout_failed", raw)
  }
  return new PayoutError("payout_failed", raw)
}

/**
 * POST /api/payouts/pix then poll GET /api/payouts/[orderId]
 * until completed | failed | stuck_funded timeout.
 * When `claimToken` is set, persist the terminal order status onto the claim.
 */
export async function executePixPayout(
  amount: number,
  apiBaseUrl: string,
  onStep?: (step: number) => void,
  claimToken?: string,
): Promise<PixPayoutResult> {
  onStep?.(1)
  const res = await fetch(joinUrl(apiBaseUrl, "/api/payouts/pix"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  })
  const data = await res.json()
  if (!res.ok) throw classifyHttpError(res.status, data)

  // Mock fallback from route still returns 200 with source:mock
  const orderId = String(data.orderId)
  const txHash = String(data.txHash ?? "")
  onStep?.(2)

  if (data.source === "mock") {
    onStep?.(3)
    onStep?.(4)
    if (claimToken) await persistClaimPayout(claimToken, apiBaseUrl)
    return { orderId, txHash, status: "completed", source: "mock" }
  }

  onStep?.(3)
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000))
    const poll = await fetch(joinUrl(apiBaseUrl, `/api/payouts/${encodeURIComponent(orderId)}`))
    const body = await poll.json()
    if (!poll.ok) throw classifyHttpError(poll.status, body)
    const lastStatus = String(body.status ?? "")
    if (lastStatus === "completed") {
      onStep?.(4)
      if (claimToken) await persistClaimPayout(claimToken, apiBaseUrl)
      return { orderId, txHash, status: "completed", source: "live" }
    }
    if (lastStatus === "failed") {
      if (claimToken) await persistClaimPayout(claimToken, apiBaseUrl)
      throw new PayoutError("anchor_rejected", "The payment provider rejected this payout.", {
        orderId,
        txHash: txHash || undefined,
      })
    }
  }
  if (claimToken) await persistClaimPayout(claimToken, apiBaseUrl)
  throw new PayoutError(
    "stuck_funded",
    "The payout was submitted but is still processing. Check back shortly.",
    { orderId, txHash: txHash || undefined },
  )
}

/** Ask the server to re-read the Etherfuse order and update the claim store. */
async function persistClaimPayout(token: string, apiBaseUrl: string): Promise<void> {
  try {
    await fetch(joinUrl(apiBaseUrl, `/api/claims/by-token/${encodeURIComponent(token)}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reconcile" }),
    })
  } catch {
    // Best-effort — GET /api/claims will reconcile later.
  }
}

/** Claim a stored claim (PIX settlement via server or Stellar forward). */
export async function claimByToken(
  token: string,
  body: { rail: "pix" | "stellar"; accessCode?: string; walletAddress?: string },
  apiBaseUrl: string,
  onStep?: (step: number) => void,
): Promise<{ status: string; txHash?: string; orderId?: string }> {
  onStep?.(1)
  const res = await fetch(
    joinUrl(apiBaseUrl, `/api/claims/by-token/${encodeURIComponent(token)}/claim`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  )
  const data = (await res.json()) as {
    status?: string
    error?: string
    message?: string
    txHash?: string
    orderId?: string
    claim?: { txHash?: string | null; payoutOrderId?: string | null }
  }
  onStep?.(3)

  const txHash = data.txHash
    ? String(data.txHash)
    : data.claim?.txHash
      ? String(data.claim.txHash)
      : undefined
  const orderId = data.orderId
    ? String(data.orderId)
    : data.claim?.payoutOrderId
      ? String(data.claim.payoutOrderId)
      : undefined

  if (!res.ok && res.status !== 202) {
    throw classifyHttpError(res.status, data)
  }

  // Server timed out while the order was still open — keep polling, then persist.
  if (data.error === "stuck_funded" || data.status === "cashing_out") {
    if (orderId) {
      const deadline = Date.now() + 90_000
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000))
        const poll = await fetch(
          joinUrl(apiBaseUrl, `/api/payouts/${encodeURIComponent(orderId)}`),
        )
        const body = await poll.json()
        if (!poll.ok) continue
        const lastStatus = String(body.status ?? "")
        if (lastStatus === "completed") {
          await persistClaimPayout(token, apiBaseUrl)
          onStep?.(4)
          return { status: "completed", txHash, orderId }
        }
        if (lastStatus === "failed") {
          await persistClaimPayout(token, apiBaseUrl)
          throw new PayoutError(
            "anchor_rejected",
            "The payment provider rejected this payout.",
            { txHash, orderId },
          )
        }
      }
    }
    await persistClaimPayout(token, apiBaseUrl)
    throw new PayoutError(
      "stuck_funded",
      data.message ?? "The payout is still processing.",
      { txHash, orderId },
    )
  }

  onStep?.(4)
  if (body.rail === "pix") await persistClaimPayout(token, apiBaseUrl)
  return {
    status: String(data.status ?? "completed"),
    txHash,
    orderId,
  }
}
