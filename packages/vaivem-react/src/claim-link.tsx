"use client"

import { useState } from "react"
import { Banknote, Lock, Wallet } from "lucide-react"
import { RampWithdraw } from "./ramp-withdraw"
import { formatUSDC } from "./utils"
import "./styles.css"

export type ClaimLinkProps = {
  /** Access code the recipient must enter to unlock the payout. */
  code: string
  onClaimed?: () => void
  apiBaseUrl?: string
  /** USDC amount locked in the claim. Default 50 for standalone demos. */
  amount?: number
  country?: "BR" | "MX"
}

type Stage = "unlock" | "choose" | "withdraw" | "stellar-done"
type Rail = "pix" | "stellar"

/**
 * Walletless claim flow: unlock with a code → choose rail → PIX ramp or USDC keep.
 */
export function ClaimLink({
  code,
  onClaimed,
  apiBaseUrl = "",
  amount = 50,
  country = "BR",
}: ClaimLinkProps) {
  const [stage, setStage] = useState<Stage>("unlock")
  const [entered, setEntered] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [rail, setRail] = useState<Rail>("pix")
  const [walletAddress, setWalletAddress] = useState("")

  function handleUnlock() {
    setError(null)
    if (entered !== code) {
      setError("That code doesn't match.")
      return
    }
    setStage("choose")
  }

  function handleContinue() {
    setError(null)
    if (rail === "pix") {
      setStage("withdraw")
      return
    }
    if (walletAddress.trim().length < 8) {
      setError("Enter a valid Stellar wallet address.")
      return
    }
    setStage("stellar-done")
    onClaimed?.()
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
                    const el = (e.target as HTMLInputElement).previousElementSibling as HTMLInputElement | null
                    el?.focus()
                  }
                }}
              />
            ))}
          </div>
          <button type="button" className="vv-linkish" onClick={() => setEntered(code)}>
            Use demo code ({code})
          </button>
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
          onPaid={() => onClaimed?.()}
        />
      ) : null}

      {stage === "stellar-done" ? (
        <div className="vv-card">
          <h2 className="vv-title">Money on the way!</h2>
          <p className="vv-desc">{formatUSDC(amount)} is being sent to your Stellar wallet.</p>
        </div>
      ) : null}
    </div>
  )
}
