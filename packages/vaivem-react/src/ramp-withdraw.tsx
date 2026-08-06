"use client"

import { useState } from "react"
import { ChevronDown, RefreshCw } from "lucide-react"
import {
  claimByToken,
  executePixPayout,
  PayoutError,
  submitKyc,
  type PayoutFailureCode,
} from "./api"
import {
  KitMessagesProvider,
  t,
  useKitMessages,
  useKitMessagesOptional,
} from "./i18n"
import { isBelowMinimum, minAmountInFiat, MIN_AMOUNT_USDC } from "./limits"
import type { DeepPartial, KitLocale, KitMessages } from "./messages"
import { resolveMessages } from "./messages"
import { ProcessSteps } from "./process-steps"
import type { KycStatus, PixKeyType } from "./types"
import { useQuote } from "./use-quote"
import { digitsOnly, formatBRL, formatUSDC } from "./utils"
import "./styles.css"

export type RampWithdrawProps = {
  amount: number
  country?: "BR" | "MX"
  onPaid?: (info: {
    reference: string
    destinationAmount: string
    txHash?: string
    status: "completed" | "cashing_out"
  }) => void
  onFailed?: (info: { code: PayoutFailureCode; message: string }) => void
  onStatus?: (status: "cashing_out" | "completed" | "failed") => void
  apiBaseUrl?: string
  /** When set, settle via /api/claims/by-token/[token]/claim instead of bare /api/payouts/pix */
  claimToken?: string
  accessCode?: string
  /** Standalone ramp defaults to English; ClaimLink provides messages via context. */
  locale?: KitLocale
  /** Partial message overrides (standalone). Nested under ClaimLink, prefer ClaimLink `messages`. */
  messages?: DeepPartial<KitMessages>
  /**
   * When true, show the simulated KYC step (format-only CPF/CNPJ check).
   * When false/undefined, skip KYC and go straight to the PIX form.
   * Host should pass NEXT_PUBLIC_DEMO_MODE === "true".
   */
  demoMode?: boolean
}

function validatePixKey(type: PixKeyType, key: string, m: KitMessages): string | null {
  const v = key.trim()
  if (!v) return t(m, "pix.validation.empty")
  switch (type) {
    case "cpf":
      return digitsOnly(v).length === 11 ? null : t(m, "pix.validation.cpf")
    case "cnpj":
      return digitsOnly(v).length === 14 ? null : t(m, "pix.validation.cnpj")
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : t(m, "pix.validation.email")
    case "phone":
      return digitsOnly(v).length >= 10 ? null : t(m, "pix.validation.phone")
    case "random":
      return v.length >= 8 ? null : t(m, "pix.validation.random")
    default:
      return null
  }
}

type Stage = "kyc" | "cashout" | "processing" | "done" | "failed"

export function RampWithdraw(props: RampWithdrawProps) {
  const parent = useKitMessagesOptional()
  const { locale, messages } = props

  // Prefer parent ClaimLink context unless this instance supplies message overrides.
  // `locale` alone may be passed through from ClaimLink for UX flags — do not re-wrap.
  if (parent && messages === undefined) {
    return <RampWithdrawInner {...props} />
  }

  const resolved = resolveMessages(locale ?? "en", messages)
  return (
    <KitMessagesProvider messages={resolved}>
      <RampWithdrawInner {...props} />
    </KitMessagesProvider>
  )
}

function RampWithdrawInner({
  amount,
  country = "BR",
  onPaid,
  onFailed,
  onStatus,
  apiBaseUrl = "",
  claimToken,
  accessCode,
  locale = "en",
  demoMode = false,
}: RampWithdrawProps) {
  const m = useKitMessages()
  const [stage, setStage] = useState<Stage>(demoMode ? "kyc" : "cashout")
  const [error, setError] = useState<string | null>(null)
  const [failure, setFailure] = useState<{ code: PayoutFailureCode; message: string } | null>(
    null,
  )

  const [kycStatus, setKycStatus] = useState<KycStatus>(
    demoMode ? "not_started" : "approved",
  )
  const [kycName, setKycName] = useState("")
  const [kycTaxId, setKycTaxId] = useState("")
  const [kycDob, setKycDob] = useState("")
  const [kycStep, setKycStep] = useState(0)
  const [kycSubmitting, setKycSubmitting] = useState(false)

  const [pixKeyType, setPixKeyType] = useState<PixKeyType>("cpf")
  const [pixKey, setPixKey] = useState("")
  const [processStep, setProcessStep] = useState(0)
  const [reference, setReference] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const showTechnicalFailure = locale !== "pt-BR"

  // Checked before any request goes out — the provider rejects sub-minimum amounts.
  const belowMinimum = isBelowMinimum(amount)

  const quoteEnabled = stage === "cashout" || stage === "processing" || stage === "done"
  const { quote, loading, error: quoteError, errorKind, refresh, secondsLeft } = useQuote(
    amount,
    country,
    {
      apiBaseUrl,
      enabled: quoteEnabled && (!demoMode || kycStatus === "approved") && !belowMinimum,
    },
  )

  const brlAmount = quote ? Number(quote.destinationAmount) : null
  const localizedMinimumMessage = t(m, "pix.minAmount", {
    usdc: formatUSDC(MIN_AMOUNT_USDC),
    fiat: minAmountInFiat(country, quote ? Number(quote.etherfuseMidMarketRate) : null),
  })
  const canPay = !belowMinimum && !quoteError && !loading && Boolean(quote)
  const displayedQuoteError = quoteError
    ? errorKind === "network"
      ? t(m, "pix.quoteNetworkError")
      : errorKind === "provider"
        ? t(m, "pix.quoteProviderError")
        : quoteError
    : quoteError

  async function handleSubmitKyc() {
    setError(null)
    if (kycName.trim().length < 2) {
      setError(t(m, "kyc.errorName"))
      return
    }
    const idLen = digitsOnly(kycTaxId).length
    if (idLen !== 11 && idLen !== 14) {
      setError(t(m, "kyc.errorTaxId"))
      return
    }
    if (!kycDob) {
      setError(t(m, "kyc.errorDob"))
      return
    }
    setKycSubmitting(true)
    setKycStep(0)
    const { status } = await submitKyc(
      { fullName: kycName, taxId: kycTaxId, dateOfBirth: kycDob },
      (s) => setKycStep(s),
    )
    setKycSubmitting(false)
    setKycStatus(status)
    if (status === "approved") {
      setStage("cashout")
    } else {
      setError(t(m, "kyc.errorVerify"))
    }
  }

  function fail(
    code: PayoutFailureCode,
    message: string,
    meta?: { txHash?: string; orderId?: string },
  ) {
    if (meta?.txHash) setTxHash(meta.txHash)
    if (meta?.orderId) setReference(meta.orderId)
    setFailure({ code, message })
    setStage("failed")
    onStatus?.("failed")
    onFailed?.({ code, message })
  }

  async function handlePay() {
    setError(null)
    if (belowMinimum) {
      setError(localizedMinimumMessage)
      return
    }
    const keyError = validatePixKey(pixKeyType, pixKey, m)
    if (keyError) {
      setError(keyError)
      return
    }
    if (!quote || secondsLeft <= 0) {
      void refresh({ force: true })
      setError(t(m, "pix.quoteExpired"))
      return
    }
    setStage("processing")
    onStatus?.("cashing_out")
    setProcessStep(0)
    try {
      if (claimToken) {
        const result = await claimByToken(
          claimToken,
          { rail: "pix", accessCode },
          apiBaseUrl,
          (s) => setProcessStep(s),
        )
        setReference(result.orderId ?? claimToken)
        if (result.txHash) setTxHash(result.txHash)
        setStage("done")
        onStatus?.("completed")
        onPaid?.({
          reference: result.orderId ?? claimToken,
          destinationAmount: quote.destinationAmount,
          txHash: result.txHash,
          status: "completed",
        })
        return
      }

      const payout = await executePixPayout(
        amount,
        apiBaseUrl,
        (s) => setProcessStep(s),
        claimToken,
      )
      setReference(payout.orderId)
      if (payout.txHash) setTxHash(payout.txHash)
      setStage("done")
      onStatus?.("completed")
      onPaid?.({
        reference: payout.orderId,
        destinationAmount: quote.destinationAmount,
        txHash: payout.txHash,
        status: "completed",
      })
    } catch (err) {
      if (err instanceof PayoutError) {
        fail(err.code, err.message, err.meta)
      } else {
        fail("network", err instanceof Error ? err.message : t(m, "pix.payoutFailed"))
      }
    }
  }

  const failureCopy = failure ? m.failure[failure.code] : null
  const keyTypeLabel = m.pix.keyTypes[pixKeyType]

  return (
    <div className="vv-kit">
      {stage === "kyc" && demoMode ? (
        <div className="vv-card">
          <div>
            <div className="vv-heading-row">
              <h2 className="vv-title">{t(m, "kyc.title")}</h2>
              <span className="vv-demo-badge">DEMO</span>
            </div>
            <p className="vv-desc">{t(m, "kyc.description")}</p>
          </div>
          {kycSubmitting ? (
            <ProcessSteps
              current={kycStep}
              steps={[
                t(m, "kyc.steps.receiving"),
                t(m, "kyc.steps.validating"),
                t(m, "kyc.steps.opening"),
              ]}
            />
          ) : (
            <div>
              <div className="vv-field">
                <label className="vv-label" htmlFor="vv-kyc-name">
                  {t(m, "kyc.nameLabel")}
                </label>
                <input
                  id="vv-kyc-name"
                  className="vv-input"
                  value={kycName}
                  onChange={(e) => setKycName(e.target.value)}
                  placeholder={t(m, "kyc.namePlaceholder")}
                />
              </div>
              <div className="vv-field">
                <label className="vv-label" htmlFor="vv-kyc-tax">
                  {t(m, "kyc.taxLabel")}
                </label>
                <input
                  id="vv-kyc-tax"
                  className="vv-input"
                  value={kycTaxId}
                  onChange={(e) => setKycTaxId(e.target.value)}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                />
                <span className="vv-hint">{t(m, "kyc.taxHint")}</span>
              </div>
              <div className="vv-field">
                <label className="vv-label" htmlFor="vv-kyc-dob">
                  {t(m, "kyc.dobLabel")}
                </label>
                <input
                  id="vv-kyc-dob"
                  className="vv-input"
                  type="date"
                  value={kycDob}
                  onChange={(e) => setKycDob(e.target.value)}
                />
              </div>
            </div>
          )}
          {belowMinimum ? <p className="vv-error">{localizedMinimumMessage}</p> : null}
          {error ? <p className="vv-error">{error}</p> : null}
          {!kycSubmitting ? (
            <button
              type="button"
              className="vv-btn"
              onClick={handleSubmitKyc}
              disabled={belowMinimum}
            >
              {t(m, "kyc.continue")}
            </button>
          ) : null}
        </div>
      ) : null}

      {stage === "cashout" ? (
        <div className="vv-card">
          <div>
            <h2 className="vv-title">{t(m, "pix.title")}</h2>
            <p className="vv-desc">
              {t(m, "pix.description", { amount: formatUSDC(amount) })}
            </p>
          </div>
          <div>
            <div className="vv-field">
              <label className="vv-label" htmlFor="vv-pix-type">
                {t(m, "pix.keyTypeLabel")}
              </label>
              <select
                id="vv-pix-type"
                className="vv-select"
                value={pixKeyType}
                onChange={(e) => setPixKeyType(e.target.value as PixKeyType)}
              >
                <option value="cpf">{m.pix.keyTypes.cpf}</option>
                <option value="cnpj">{m.pix.keyTypes.cnpj}</option>
                <option value="email">{m.pix.keyTypes.email}</option>
                <option value="phone">{m.pix.keyTypes.phone}</option>
                <option value="random">{m.pix.keyTypes.random}</option>
              </select>
            </div>
            <div className="vv-field">
              <label className="vv-label" htmlFor="vv-pix-key">
                {t(m, "pix.keyLabel")}
              </label>
              <input
                id="vv-pix-key"
                className="vv-input"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder={
                  pixKeyType === "email"
                    ? "you@email.com"
                    : pixKeyType === "phone"
                      ? "+55 11 90000-0000"
                      : t(m, "pix.keyPlaceholder", { type: keyTypeLabel })
                }
              />
              <span className="vv-hint">{t(m, "pix.hint")}</span>
            </div>
          </div>

          <div className="vv-divider" />

          {belowMinimum ? (
            <p className="vv-error">{localizedMinimumMessage}</p>
          ) : displayedQuoteError ? (
            /* The real reason, inline with the amount — not an outage banner. */
            <p className="vv-error">{displayedQuoteError}</p>
          ) : loading || !quote ? (
            <div className="vv-stack">
              <div className="vv-skeleton" />
              <div className="vv-skeleton" style={{ width: "66%" }} />
            </div>
          ) : (
            <>
              <div className="vv-stack">
                <div className="vv-row">
                  <span className="vv-muted">{t(m, "pix.youReceive")}</span>
                  <span className="vv-strong">{formatBRL(brlAmount ?? 0)}</span>
                </div>
                <div className="vv-countdown">
                  <span
                    className="vv-muted"
                    style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
                  >
                    <RefreshCw className="vv-icon-sm" />
                    {t(m, "pix.quoteRefreshes")}
                  </span>
                  <span className="vv-mono vv-strong">
                    {String(Math.floor(secondsLeft / 60)).padStart(1, "0")}:
                    {String(secondsLeft % 60).padStart(2, "0")}
                  </span>
                </div>
                <details className="vv-disclosure vv-disclosure--rates">
                  <summary>
                    <ChevronDown className="vv-icon-sm" />
                    {t(m, "pix.details")}
                  </summary>
                  <div className="vv-stack">
                    <div className="vv-row">
                      <span className="vv-muted">{t(m, "pix.etherfuseRate")}</span>
                      <span className="vv-mono">
                        1 USDC = {Number(quote.exchangeRate).toFixed(4)} BRL
                      </span>
                    </div>
                    <div className="vv-row">
                      <span className="vv-muted">{t(m, "pix.midMarket")}</span>
                      <span className="vv-mono">
                        1 USDC = {Number(quote.etherfuseMidMarketRate).toFixed(4)} BRL
                      </span>
                    </div>
                    <div className="vv-row">
                      <span className="vv-muted">
                        {t(m, "pix.providerFee")} ({(Number(quote.feeBps) / 100).toFixed(2)}%)
                      </span>
                      <span className="vv-mono">{formatUSDC(Number(quote.feeAmount))}</span>
                    </div>
                  </div>
                </details>
              </div>
              <div className="vv-heading-row" style={{ marginTop: 8 }}>
                <p className={quote.source === "mock" ? "vv-note vv-note--amber" : "vv-note"}>
                  {quote.source === "mock" ? t(m, "pix.mockQuote") : t(m, "pix.liveQuote")}
                </p>
                {quote.source === "mock" ? <span className="vv-demo-badge">DEMO</span> : null}
              </div>
            </>
          )}

          {error ? <p className="vv-error">{error}</p> : null}
          {brlAmount !== null ? (
            <p className="vv-expectation">
              {t(m, "pix.expectation", { amount: formatBRL(brlAmount) })}
            </p>
          ) : null}

          <button
            type="button"
            className="vv-btn"
            onClick={handlePay}
            disabled={!canPay}
          >
            {t(m, "pix.claimButton")}{" "}
            {brlAmount !== null ? formatBRL(brlAmount) : formatUSDC(amount)}
          </button>
        </div>
      ) : null}

      {stage === "processing" ? (
        <div className="vv-card">
          <div>
            <h2 className="vv-title">{t(m, "pix.processingTitle")}</h2>
            <p className="vv-desc">{t(m, "pix.processingDesc")}</p>
          </div>
          <ProcessSteps
            current={processStep}
            steps={[
              t(m, "pix.steps.confirming"),
              t(m, "pix.steps.sending"),
              t(m, "pix.steps.deposit"),
            ]}
          />
        </div>
      ) : null}

      {stage === "done" ? (
        <div className="vv-card">
          <div>
            <h2 className="vv-title">{t(m, "pix.doneTitle")}</h2>
            <p className="vv-desc">
              {t(m, "pix.doneDesc", {
                amount: brlAmount !== null ? formatBRL(brlAmount) : formatUSDC(amount),
              })}
            </p>
          </div>
          {reference ? (
            <div className="vv-row">
              <span className="vv-muted">{t(m, "pix.orderLabel")}</span>
              <span className="vv-mono" style={{ fontSize: 12, wordBreak: "break-all", textAlign: "right" }}>
                {reference}
              </span>
            </div>
          ) : null}
          {txHash ? (
            <div className="vv-row">
              <span className="vv-muted">{t(m, "pix.txLabel")}</span>
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
          {reference ? (
            <div className="vv-row">
              <span className="vv-muted">{t(m, "pix.orderLabel")}</span>
              <span className="vv-mono" style={{ fontSize: 12, wordBreak: "break-all", textAlign: "right" }}>
                {reference}
              </span>
            </div>
          ) : null}
          {txHash ? (
            <div className="vv-row">
              <span className="vv-muted">{t(m, "pix.txLabel")}</span>
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
          <button
            type="button"
            className="vv-btn"
            onClick={() => {
              setFailure(null)
              setStage("cashout")
            }}
          >
            {failureCopy.action}
          </button>
        </div>
      ) : null}
    </div>
  )
}
