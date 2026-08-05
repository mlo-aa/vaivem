"use client"

import { useState } from "react"
import { RefreshCw } from "lucide-react"
import { submitKyc, simulatePixPayout } from "./api"
import { ProcessSteps } from "./process-steps"
import type { KycStatus, PixKeyType } from "./types"
import { useQuote } from "./use-quote"
import { digitsOnly, formatBRL, formatUSDC } from "./utils"
import "./styles.css"

export type RampWithdrawProps = {
  amount: number
  country?: "BR" | "MX"
  onPaid?: (info: { reference: string; destinationAmount: string }) => void
  apiBaseUrl?: string
}

const PIX_KEY_LABEL: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "Email",
  phone: "Phone",
  random: "Random key",
}

function validatePixKey(type: PixKeyType, key: string): string | null {
  const v = key.trim()
  if (!v) return "Enter your PIX key."
  switch (type) {
    case "cpf":
      return digitsOnly(v).length === 11 ? null : "CPF must have 11 digits."
    case "cnpj":
      return digitsOnly(v).length === 14 ? null : "CNPJ must have 14 digits."
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "Enter a valid email PIX key."
    case "phone":
      return digitsOnly(v).length >= 10 ? null : "Enter a valid phone PIX key."
    case "random":
      return v.length >= 8 ? null : "Random keys are at least 8 characters."
    default:
      return null
  }
}

type Stage = "kyc" | "cashout" | "processing" | "done"

/**
 * Quote + countdown + KYC gate + PIX cash-out.
 * Point `apiBaseUrl` at the host that serves POST /api/quote.
 */
export function RampWithdraw({
  amount,
  country = "BR",
  onPaid,
  apiBaseUrl = "",
}: RampWithdrawProps) {
  const [stage, setStage] = useState<Stage>("kyc")
  const [error, setError] = useState<string | null>(null)

  const [kycStatus, setKycStatus] = useState<KycStatus>("not_started")
  const [kycName, setKycName] = useState("")
  const [kycTaxId, setKycTaxId] = useState("")
  const [kycDob, setKycDob] = useState("")
  const [kycStep, setKycStep] = useState(0)
  const [kycSubmitting, setKycSubmitting] = useState(false)

  const [pixKeyType, setPixKeyType] = useState<PixKeyType>("cpf")
  const [pixKey, setPixKey] = useState("")
  const [processStep, setProcessStep] = useState(0)
  const [reference, setReference] = useState<string | null>(null)

  const quoteEnabled = stage === "cashout" || stage === "processing" || stage === "done"
  const { quote, loading, error: quoteError, refresh, secondsLeft } = useQuote(
    amount,
    country,
    { apiBaseUrl, enabled: quoteEnabled && kycStatus === "approved" },
  )

  const brlAmount = quote ? Number(quote.destinationAmount) : null
  const displayError = error ?? quoteError

  async function handleSubmitKyc() {
    setError(null)
    if (kycName.trim().length < 2) {
      setError("Enter your full legal name.")
      return
    }
    const idLen = digitsOnly(kycTaxId).length
    if (idLen !== 11 && idLen !== 14) {
      setError("Enter a valid CPF (11 digits) or CNPJ (14 digits).")
      return
    }
    if (!kycDob) {
      setError("Enter your date of birth.")
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
      setError("We couldn't verify that identity. Check the details and try again.")
    }
  }

  async function handlePay() {
    setError(null)
    const keyError = validatePixKey(pixKeyType, pixKey)
    if (keyError) {
      setError(keyError)
      return
    }
    if (!quote || secondsLeft <= 0) {
      void refresh()
      setError("Your quote expired. We refreshed it — confirm the new amount.")
      return
    }
    setStage("processing")
    const payout = await simulatePixPayout((s) => setProcessStep(s))
    setReference(payout.reference)
    setStage("done")
    onPaid?.({ reference: payout.reference, destinationAmount: quote.destinationAmount })
  }

  return (
    <div className="vv-kit">
      {stage === "kyc" ? (
        <div className="vv-card">
          <div>
            <h2 className="vv-title">Verify your identity</h2>
            <p className="vv-desc">
              Required before a PIX cash-out. This is a one-time step.
            </p>
          </div>
          {kycSubmitting ? (
            <ProcessSteps
              current={kycStep}
              steps={["Submitting details", "Checking against registry", "Approving payout"]}
            />
          ) : (
            <div>
              <div className="vv-field">
                <label className="vv-label" htmlFor="vv-kyc-name">
                  Full legal name
                </label>
                <input
                  id="vv-kyc-name"
                  className="vv-input"
                  value={kycName}
                  onChange={(e) => setKycName(e.target.value)}
                  placeholder="As it appears on your ID"
                />
              </div>
              <div className="vv-field">
                <label className="vv-label" htmlFor="vv-kyc-tax">
                  CPF or CNPJ
                </label>
                <input
                  id="vv-kyc-tax"
                  className="vv-input"
                  value={kycTaxId}
                  onChange={(e) => setKycTaxId(e.target.value)}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                />
                <span className="vv-hint">Individuals use CPF; businesses use CNPJ.</span>
              </div>
              <div className="vv-field">
                <label className="vv-label" htmlFor="vv-kyc-dob">
                  Date of birth
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
          {displayError ? <p className="vv-error">{displayError}</p> : null}
          {!kycSubmitting ? (
            <button type="button" className="vv-btn" onClick={handleSubmitKyc}>
              Verify and continue
            </button>
          ) : null}
        </div>
      ) : null}

      {stage === "cashout" ? (
        <div className="vv-card">
          <div>
            <h2 className="vv-title">Where should we send it?</h2>
            <p className="vv-desc">Enter your PIX key to receive {formatUSDC(amount)} as BRL.</p>
          </div>
          <div>
            <div className="vv-field">
              <label className="vv-label" htmlFor="vv-pix-type">
                PIX key type
              </label>
              <select
                id="vv-pix-type"
                className="vv-select"
                value={pixKeyType}
                onChange={(e) => setPixKeyType(e.target.value as PixKeyType)}
              >
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="random">Random key</option>
              </select>
            </div>
            <div className="vv-field">
              <label className="vv-label" htmlFor="vv-pix-key">
                PIX key
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
                      : `Your ${PIX_KEY_LABEL[pixKeyType]}`
                }
              />
              <span className="vv-hint">Funds arrive in your bank in under 2 minutes.</span>
            </div>
          </div>

          <div className="vv-divider" />

          {loading || !quote ? (
            <div className="vv-stack">
              <div className="vv-skeleton" />
              <div className="vv-skeleton" style={{ width: "66%" }} />
            </div>
          ) : (
            <>
              <div className="vv-stack">
                <div className="vv-row">
                  <span className="vv-muted">You receive</span>
                  <span className="vv-strong">{formatBRL(brlAmount ?? 0)}</span>
                </div>
                <div className="vv-row">
                  <span className="vv-muted">Etherfuse rate</span>
                  <span className="vv-mono">
                    1 USDC = {Number(quote.exchangeRate).toFixed(4)} BRL
                  </span>
                </div>
                <div className="vv-row">
                  <span className="vv-muted">Mid-market</span>
                  <span className="vv-mono">
                    1 USDC = {Number(quote.etherfuseMidMarketRate).toFixed(4)} BRL
                  </span>
                </div>
                <div className="vv-row">
                  <span className="vv-muted">
                    Provider fee ({(Number(quote.feeBps) / 100).toFixed(2)}%)
                  </span>
                  <span className="vv-mono">{formatUSDC(Number(quote.feeAmount))}</span>
                </div>
                <div className="vv-countdown">
                  <span className="vv-muted" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <RefreshCw className="vv-icon-sm" />
                    Quote refreshes in
                  </span>
                  <span className="vv-mono vv-strong">
                    {String(Math.floor(secondsLeft / 60)).padStart(1, "0")}:
                    {String(secondsLeft % 60).padStart(2, "0")}
                  </span>
                </div>
              </div>
              <p className={quote.source === "mock" ? "vv-note vv-note--amber" : "vv-note"}>
                {quote.source === "mock"
                  ? "Simulated quote — live provider unavailable"
                  : "Live quote from Etherfuse sandbox"}
              </p>
            </>
          )}

          {displayError ? <p className="vv-error">{displayError}</p> : null}

          <button
            type="button"
            className="vv-btn"
            onClick={handlePay}
            disabled={loading || !quote}
          >
            Claim {brlAmount !== null ? formatBRL(brlAmount) : formatUSDC(amount)}
          </button>
        </div>
      ) : null}

      {stage === "processing" ? (
        <div className="vv-card">
          <div>
            <h2 className="vv-title">Sending your money</h2>
            <p className="vv-desc">This usually takes a few seconds.</p>
          </div>
          <ProcessSteps
            current={processStep}
            steps={[
              "Releasing funds from escrow",
              "Converting USDC to BRL",
              "Sending PIX transfer",
              "Confirming deposit",
            ]}
          />
        </div>
      ) : null}

      {stage === "done" ? (
        <div className="vv-card">
          <div>
            <h2 className="vv-title">Money on the way!</h2>
            <p className="vv-desc">
              {brlAmount !== null ? formatBRL(brlAmount) : formatUSDC(amount)} is landing in your
              account now.
            </p>
          </div>
          {reference ? (
            <div className="vv-row">
              <span className="vv-muted">Reference</span>
              <span className="vv-mono">{reference}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
