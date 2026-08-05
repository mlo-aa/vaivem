import type { Quote } from "./types"

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/$/, "")
  return `${b}${path}`
}

/** POST {apiBaseUrl}/api/quote — never hardcodes an origin. */
export async function fetchQuote(
  amount: number,
  country: "BR" | "MX",
  apiBaseUrl: string,
): Promise<Quote> {
  const res = await fetch(joinUrl(apiBaseUrl, "/api/quote"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, country }),
  })
  if (!res.ok) throw new Error("Quote request failed")
  return res.json()
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

export async function simulatePixPayout(onStep?: (step: number) => void): Promise<{ reference: string }> {
  for (let i = 1; i <= 4; i++) {
    await new Promise((r) => setTimeout(r, 600))
    onStep?.(i)
  }
  return { reference: `pix_${Math.random().toString(36).slice(2, 8).toUpperCase()}` }
}
