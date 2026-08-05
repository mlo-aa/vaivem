"use client"

import { useState } from "react"
import { Banknote, Lock, Wallet } from "lucide-react"
import { claimByToken, PayoutError, type PayoutFailureCode } from "./api"
import { RampWithdraw } from "./ramp-withdraw"
import { formatUSDC } from "./utils"
import "./styles.css"

export type ClaimLinkProps = {
  /**
   * Expected access code for local unlock (kit demos).
   * Prefer server verification via claimToken when the code must stay secret.
   */
  code?: string
  /** When true, recipient must enter a code before choosing a rail. */
  requiresCode?: boolean
  /** Show “use demo code” fill only when host sets this (and usually DEMO_MODE). */
  showDemoCodeHint?: boolean
  onClaimed?: (info?: { txHash?: string; status?: string }) => void
  onStatus?: (status: "cashing_out" | "completed" | "failed") => void
  apiBaseUrl?: string
  /** USDC amount locked in the claim. Default 50 for standalone demos. */
  amount?: number
  country?: "BR" | "MX"
  /** When set, PIX/Stellar settle via /api/claims/by-token/[token]/claim */
  claimToken?: string
}

type Stage = "unlock" | "choose" | "withdraw" | "stellar-processing" | "stellar-done" | "failed"
type Rail = "pix" | "stellar"

const FAILURE_COPY: Record<
  PayoutFailureCode,
  { title: string; body: string; action: string }
> = {
  already_claimed: {
    title: "Already claimed",
    body: "This payout was already collected.",
    action: "Close",
  },
  expired: {
    title: "Payout expired",
    body: "The claim window closed. Ask the sender for a new link.",
    action: "Close",
  },
  anchor_rejected: {
    title: "Payment provider rejected",
    body: "The bank transfer could not be completed.",
    action: "Try again",
  },
  insufficient_balance: {
    title: "Sender out of funds",
    body: "The sender wallet does not have enough USDC right now.",
    action: "Close",
  },
  stuck_funded: {
    title: "Still processing",
    body: "Your payout was submitted but is not confirmed yet.",
    action: "Check status later",
  },
  payout_failed: {
    title: "Payout failed",
    body: "Something went wrong sending your money.",
    action: "Try again",
  },
  network: {
    title: "Connection problem",
    body: "We could not reach the payout service.",
    action: "Try again",
  },
}

/**
 * Walletless claim flow: unlock with a code → choose rail → PIX ramp or USDC keep.
 */
export function ClaimLink({
  code,
  requiresCode = Boolean(code),
  showDemoCodeHint = false,
  onClaimed,
  onStatus,
  apiBaseUrl = "",
  amount = 50,
  country = "BR",
  claimToken,
}: ClaimLinkProps) {
  const [stage, setStage] = useState<Stage>(requiresCode ? "unlock" : "choose")
  const [entered, setEntered] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [rail, setRail] = useState<Rail>("pix")
  const [walletAddress, setWalletAddress] = useState("")
  const [txHash, setTxHash] = useState<string | null>(null)
  const [failure, setFailure] = useState<{ code: PayoutFailureCode; message: string } | null>(
    null,
  )

  async function verifyUnlockCode(candidate: string): Promise<boolean> {
    if (code != null && code !== "") {
      return candidate === code
    }
    if (!claimToken) {
      // No server token and no local code — accept any non-empty entry.
      return candidate.length >= 4
    }
    const res = await fetch(
      `${apiBaseUrl.replace(/\/$/, "")}/api/claims/by-token/${encodeURIComponent(claimToken)}/unlock`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: candidate }),
      },
    )
    if (res.ok) return true
    return false
  }

  async function handleUnlock() {
    setError(null)
    try {
      const ok = await verifyUnlockCode(entered)
      if (!ok) {
        setError("That code doesn't match.")
        return
      }
      setStage("choose")
    } catch {
      setError("Could not verify the code. Try again.")
    }
  }

  function fail(code: PayoutFailureCode, message: string) {
    setFailure({ code, message })
    setStage("failed")
    onStatus?.("failed")
  }

  async function handleContinue() {
    setError(null)
    if (rail === "pix") {
      setStage("withdraw")
      return
    }
    if (walletAddress.trim().length < 8) {
      setError("Enter a valid Stellar wallet address.")
      return
    }
    if (!claimToken) {
      // Standalone kit demo without a server claim — success UX only.
      setStage("stellar-done")
      onClaimed?.({ status: "completed" })
      return
    }

    setStage("stellar-processing")
    onStatus?.("cashing_out")
    try {
      const result = await claimByToken(
        claimToken,
        {
          rail: "stellar",
          accessCode: requiresCode ? entered : undefined,
          walletAddress: walletAddress.trim(),
        },
        apiBaseUrl,
      )
      if (result.txHash) setTxHash(result.txHash)
      setStage("stellar-done")
      onStatus?.("completed")
      onClaimed?.({ txHash: result.txHash, status: "completed" })
    } catch (err) {
      if (err instanceof PayoutError) {
        fail(err.code, err.message)
      } else {
        fail("network", err instanceof Error ? err.message : "Claim failed")
      }
    }
  }

  return (
    <div className="vv-kit" style={{ maxWidth: 28 * 16, margin: "0 auto", width: "100%" }}>
      <div className="vv-hero">
        <p className="vv-muted" style={{ margin: 0, fontSize: "0.875rem" }}>
          You received
        </p>
        <p className="vv-hero-amount">{formatUSDC(amount)}</p>
      </div>

      {stage === "unlock" ? (
        <div className="vv-card">
          <div>
            <h2 className="vv-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Lock className="vv-icon-sm" />
              Enter your access code
            </h2>
            <p className="vv-desc">The sender shared a 6-digit code with you.</p>
          </div>
          <div className="vv-otp">
            {Array.from({ length: 6 }).map((_, i) => (
              <input
                key={i}
                inputMode="numeric"
                maxLength={1}
                value={entered[i] ?? ""}
                onChange={(e) => {
                  const ch = e.target.value.replace(/\D/g, "").slice(-1)
                  const next = entered.split("")
                  next[i] = ch
                  const joined = next.join("").slice(0, 6)
                  setEntered(joined)
                  const el = e.target.nextElementSibling as HTMLInputElement | null
                  if (ch && el) el.focus()
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !entered[i]) {
                    const el = (e.target as HTMLInputElement)
                      .previousElementSibling as HTMLInputElement | null
                    el?.focus()
                  }
                }}
              />
            ))}
          </div>
          {showDemoCodeHint && code ? (
            <button type="button" className="vv-linkish" onClick={() => setEntered(code)}>
              Use demo code ({code})
            </button>
          ) : showDemoCodeHint ? (
            <p className="vv-hint">Demo mode: use the access code the sender shared.</p>
          ) : null}
          {error ? <p className="vv-error">{error}</p> : null}
          <button type="button" className="vv-btn" onClick={handleUnlock}>
            Unlock my payout
          </button>
        </div>
      ) : null}

      {stage === "choose" ? (
        <div className="vv-card">
          <div>
            <h2 className="vv-title">How do you want your money?</h2>
            <p className="vv-desc">Choose the payout that works for you.</p>
          </div>
          <div className="vv-stack">
            <button
              type="button"
              className="vv-rail"
              data-selected={rail === "pix"}
              onClick={() => setRail("pix")}
            >
              <span className="vv-rail-icon">
                <Banknote className="vv-icon-sm" />
              </span>
              <span>
                <span style={{ display: "block", fontSize: "0.875rem", fontWeight: 500 }}>
                  Instant bank via PIX
                </span>
                <span className="vv-muted" style={{ fontSize: "0.75rem" }}>
                  Cash into your Brazilian bank account
                </span>
              </span>
              <span className="vv-rail-eta">Under 2 min</span>
            </button>
            <button
              type="button"
              className="vv-rail"
              data-selected={rail === "stellar"}
              onClick={() => setRail("stellar")}
            >
              <span className="vv-rail-icon">
                <Wallet className="vv-icon-sm" />
              </span>
              <span>
                <span style={{ display: "block", fontSize: "0.875rem", fontWeight: 500 }}>
                  Keep as USDC
                </span>
                <span className="vv-muted" style={{ fontSize: "0.75rem" }}>
                  Send to a Stellar wallet address
                </span>
              </span>
              <span className="vv-rail-eta">Instant</span>
            </button>
          </div>
          {rail === "stellar" ? (
            <div className="vv-field">
              <label className="vv-label" htmlFor="vv-wallet">
                Wallet address
              </label>
              <input
                id="vv-wallet"
                className="vv-input"
                style={{ fontFamily: "var(--vv-mono)" }}
                placeholder="G… Stellar address"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
              />
            </div>
          ) : null}
          {error ? <p className="vv-error">{error}</p> : null}
          <button type="button" className="vv-btn" onClick={handleContinue}>
            Continue
          </button>
        </div>
      ) : null}

      {stage === "withdraw" ? (
        <RampWithdraw
          amount={amount}
          country={country}
          apiBaseUrl={apiBaseUrl}
          claimToken={claimToken}
          accessCode={requiresCode ? entered : undefined}
          onStatus={onStatus}
          onPaid={(info) => onClaimed?.({ txHash: info.txHash, status: info.status })}
          onFailed={(info) => fail(info.code, info.message)}
        />
      ) : null}

      {stage === "stellar-processing" ? (
        <div className="vv-card">
          <h2 className="vv-title">Sending your money</h2>
          <p className="vv-desc">Forwarding USDC to your Stellar wallet…</p>
        </div>
      ) : null}

      {stage === "stellar-done" ? (
        <div className="vv-card">
          <h2 className="vv-title">Money on the way!</h2>
          <p className="vv-desc">{formatUSDC(amount)} is being sent to your Stellar wallet.</p>
          {txHash ? (
            <div className="vv-row">
              <span className="vv-muted">Transaction</span>
              <span className="vv-mono" style={{ fontSize: 11 }}>
                {txHash.slice(0, 12)}…
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {stage === "failed" && failure ? (
        <div className="vv-card">
          <div>
            <h2 className="vv-title">{FAILURE_COPY[failure.code].title}</h2>
            <p className="vv-desc">{FAILURE_COPY[failure.code].body}</p>
            <p className="vv-error" style={{ marginTop: 8 }}>
              {failure.message}
            </p>
          </div>
          <button type="button" className="vv-btn" onClick={() => setStage("choose")}>
            {FAILURE_COPY[failure.code].action}
          </button>
        </div>
      ) : null}
    </div>
  )
}
