"use client"

import { useState } from "react"
import { Banknote, ChevronDown, Lock, Wallet } from "lucide-react"
import { claimByToken, PayoutError, type PayoutFailureCode } from "./api"
import { KitMessagesProvider, t, useKitMessages } from "./i18n"
import { formatFiat } from "./limits"
import type { DeepPartial, KitLocale, KitMessages } from "./messages"
import { resolveMessages } from "./messages"
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
  /** Recipient language. Claim links default to Brazilian Portuguese. */
  locale?: KitLocale
  /** Partial message overrides merged onto the locale catalog. */
  messages?: DeepPartial<KitMessages>
  /** Optional sender-facing fiat amount. Falls back to the sandbox reference rate. */
  fiatAmount?: number
  /** When set, PIX/Stellar settle via /api/claims/by-token/[token]/claim */
  claimToken?: string
  /**
   * When true, RampWithdraw shows simulated KYC. Pass host NEXT_PUBLIC_DEMO_MODE.
   */
  demoMode?: boolean
}

type Stage = "unlock" | "choose" | "withdraw" | "stellar-processing" | "stellar-done" | "failed"
type Rail = "pix" | "stellar"

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
  locale = "pt-BR",
  messages,
  fiatAmount,
  claimToken,
  demoMode = false,
}: ClaimLinkProps) {
  const resolved = resolveMessages(locale, messages)
  return (
    <KitMessagesProvider messages={resolved}>
      <ClaimLinkInner
        code={code}
        requiresCode={requiresCode}
        showDemoCodeHint={showDemoCodeHint}
        onClaimed={onClaimed}
        onStatus={onStatus}
        apiBaseUrl={apiBaseUrl}
        amount={amount}
        country={country}
        locale={locale}
        fiatAmount={fiatAmount}
        claimToken={claimToken}
        demoMode={demoMode}
      />
    </KitMessagesProvider>
  )
}

function ClaimLinkInner({
  code,
  requiresCode = Boolean(code),
  showDemoCodeHint = false,
  onClaimed,
  onStatus,
  apiBaseUrl = "",
  amount = 50,
  country = "BR",
  locale = "pt-BR",
  fiatAmount,
  claimToken,
  demoMode = false,
}: Omit<ClaimLinkProps, "messages">) {
  const m = useKitMessages()
  const [stage, setStage] = useState<Stage>(requiresCode ? "unlock" : "choose")
  const [entered, setEntered] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [rail, setRail] = useState<Rail>("pix")
  const [walletAddress, setWalletAddress] = useState("")
  const [txHash, setTxHash] = useState<string | null>(null)
  const [failure, setFailure] = useState<{ code: PayoutFailureCode; message: string } | null>(
    null,
  )
  const localAmount = fiatAmount ?? amount * (country === "BR" ? 5.13193556 : 18.42)
  const primaryAmount = formatFiat(localAmount, country)
  const showTechnicalFailure = locale !== "pt-BR"

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
        setError(t(m, "unlock.codeMismatch"))
        return
      }
      setStage("choose")
    } catch {
      setError(t(m, "unlock.verifyFailed"))
    }
  }

  function fail(
    code: PayoutFailureCode,
    message: string,
    meta?: { txHash?: string; orderId?: string },
  ) {
    if (meta?.txHash) setTxHash(meta.txHash)
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
      setError(t(m, "choose.invalidWallet"))
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
        fail(err.code, err.message, err.meta)
      } else {
        fail("network", err instanceof Error ? err.message : t(m, "stellar.claimFailed"))
      }
    }
  }

  const failureCopy = failure ? m.failure[failure.code] : null

  return (
    <div className="vv-kit" style={{ maxWidth: 28 * 16, margin: "0 auto", width: "100%" }}>
      <div className="vv-hero">
        <p className="vv-muted" style={{ margin: 0, fontSize: "0.875rem" }}>
          {t(m, "hero.youReceived")}
        </p>
        <p className="vv-hero-amount">{primaryAmount}</p>
        <p className="vv-hero-secondary">{formatUSDC(amount)}</p>
      </div>

      {stage === "unlock" ? (
        <div className="vv-card">
          <div>
            <h2 className="vv-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Lock className="vv-icon-sm" />
              {t(m, "unlock.title")}
            </h2>
            <p className="vv-desc">{t(m, "unlock.description")}</p>
          </div>
          <div className="vv-field" style={{ marginBottom: 0 }}>
            <label className="vv-label" htmlFor="vv-access-code">
              {t(m, "unlock.codeLabel")}
            </label>
            <input
              id="vv-access-code"
              className="vv-input vv-otp-single"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={entered}
              onChange={(e) => setEntered(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
            />
          </div>
          {showDemoCodeHint && code ? (
            <button type="button" className="vv-linkish" onClick={() => setEntered(code)}>
              {t(m, "unlock.useDemoCode", { code })}
            </button>
          ) : showDemoCodeHint ? (
            <p className="vv-hint">{t(m, "unlock.demoHint")}</p>
          ) : null}
          {error ? <p className="vv-error">{error}</p> : null}
          <button type="button" className="vv-btn" onClick={handleUnlock}>
            {t(m, "unlock.unlockButton")}
          </button>
        </div>
      ) : null}

      {stage === "choose" ? (
        <div className="vv-card">
          <div>
            <h2 className="vv-title">{t(m, "choose.title")}</h2>
            <p className="vv-desc">{t(m, "choose.description")}</p>
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
                  {t(m, "choose.pixTitle")}
                </span>
                <span className="vv-muted" style={{ fontSize: "0.75rem" }}>
                  {t(m, "choose.pixDesc")}
                </span>
              </span>
              <span className="vv-rail-eta">{t(m, "choose.pixEta")}</span>
            </button>
            <details className="vv-disclosure">
              <summary>
                <ChevronDown className="vv-icon-sm" />
                {t(m, "choose.advanced")}
              </summary>
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
                    {t(m, "choose.stellarTitle")}
                  </span>
                  <span className="vv-muted" style={{ fontSize: "0.75rem" }}>
                    {t(m, "choose.stellarDesc")}
                  </span>
                </span>
              </button>
            </details>
          </div>
          {rail === "stellar" ? (
            <div className="vv-field">
              <label className="vv-label" htmlFor="vv-wallet">
                {t(m, "choose.walletLabel")}
              </label>
              <input
                id="vv-wallet"
                className="vv-input"
                style={{ fontFamily: "var(--vv-mono)" }}
                placeholder={t(m, "choose.walletPlaceholder")}
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
              />
            </div>
          ) : null}
          {error ? <p className="vv-error">{error}</p> : null}
          <button type="button" className="vv-btn" onClick={handleContinue}>
            {t(m, "choose.continue")}
          </button>
        </div>
      ) : null}

      {stage === "withdraw" ? (
        <RampWithdraw
          amount={amount}
          country={country}
          locale={locale}
          apiBaseUrl={apiBaseUrl}
          claimToken={claimToken}
          accessCode={requiresCode ? entered : undefined}
          demoMode={demoMode}
          onStatus={onStatus}
          onPaid={(info) => onClaimed?.({ txHash: info.txHash, status: info.status })}
        />
      ) : null}

      {stage === "stellar-processing" ? (
        <div className="vv-card">
          <h2 className="vv-title">{t(m, "stellar.processingTitle")}</h2>
          <p className="vv-desc">{t(m, "stellar.processingDesc")}</p>
        </div>
      ) : null}

      {stage === "stellar-done" ? (
        <div className="vv-card">
          <h2 className="vv-title">{t(m, "stellar.doneTitle")}</h2>
          <p className="vv-desc">
            {t(m, "stellar.doneDesc", { amount: formatUSDC(amount) })}
          </p>
          {txHash ? (
            <div className="vv-row">
              <span className="vv-muted">{t(m, "stellar.txLabel")}</span>
              <a
                className="vv-mono vv-receipt-link"
                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {txHash.slice(0, 8)}…{txHash.slice(-8)}
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      {stage === "failed" && failure && failureCopy ? (
        <div className="vv-card">
          <div>
            <h2 className="vv-title">{failureCopy.title}</h2>
            <p className="vv-desc">{failureCopy.body}</p>
            {showTechnicalFailure ? (
              <p className="vv-error" style={{ marginTop: 8 }}>
                {failure.message}
              </p>
            ) : null}
          </div>
          {txHash ? (
            <div className="vv-row">
              <span className="vv-muted">{t(m, "stellar.txLabel")}</span>
              <a
                className="vv-mono vv-receipt-link"
                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {txHash.slice(0, 8)}…{txHash.slice(-8)}
              </a>
            </div>
          ) : null}
          <button type="button" className="vv-btn" onClick={() => setStage("choose")}>
            {failureCopy.action}
          </button>
        </div>
      ) : null}
    </div>
  )
}
