"use client"

import { useState } from "react"
import { Banknote, ChevronDown, Lock, Wallet } from "lucide-react"
import { claimByToken, PayoutError, type PayoutFailureCode } from "./api"
import { formatFiat } from "./limits"
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
  locale?: "pt-BR" | "en"
  /** Optional sender-facing fiat amount. Falls back to the sandbox reference rate. */
  fiatAmount?: number
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

const FAILURE_COPY_PT: typeof FAILURE_COPY = {
  already_claimed: {
    title: "Este valor já foi recebido",
    body: "Este pagamento já foi resgatado.",
    action: "Fechar",
  },
  expired: {
    title: "O prazo terminou",
    body: "Peça um novo link para a pessoa que enviou o pagamento.",
    action: "Fechar",
  },
  anchor_rejected: {
    title: "O banco não aceitou o pagamento",
    body: "Confira os dados ou tente novamente mais tarde.",
    action: "Tentar novamente",
  },
  insufficient_balance: {
    title: "A conta de envio está sem saldo",
    body: "A pessoa que enviou precisa adicionar saldo antes de você tentar novamente.",
    action: "Fechar",
  },
  stuck_funded: {
    title: "Ainda estamos processando",
    body: "O envio foi iniciado, mas ainda não foi confirmado.",
    action: "Verificar depois",
  },
  payout_failed: {
    title: "Não foi possível enviar",
    body: "Nada foi enviado. Você pode tentar novamente.",
    action: "Tentar novamente",
  },
  network: {
    title: "Sem conexão com o serviço",
    body: "Confira sua internet e tente novamente.",
    action: "Tentar novamente",
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
  locale = "pt-BR",
  fiatAmount,
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
  const pt = locale === "pt-BR"
  const localAmount = fiatAmount ?? amount * (country === "BR" ? 5.13193556 : 18.42)
  const primaryAmount = formatFiat(localAmount, country)

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
        setError(pt ? "Esse código não confere." : "That code doesn't match.")
        return
      }
      setStage("choose")
    } catch {
      setError(pt ? "Não foi possível verificar o código. Tente novamente." : "Could not verify the code. Try again.")
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
      setError(pt ? "Digite um endereço de carteira válido." : "Enter a valid wallet address.")
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
        fail("network", err instanceof Error ? err.message : pt ? "Não foi possível receber." : "Claim failed")
      }
    }
  }

  return (
    <div className="vv-kit" style={{ maxWidth: 28 * 16, margin: "0 auto", width: "100%" }}>
      <div className="vv-hero">
        <p className="vv-muted" style={{ margin: 0, fontSize: "0.875rem" }}>
          {pt ? "Você recebeu" : "You received"}
        </p>
        <p className="vv-hero-amount">{primaryAmount}</p>
        <p className="vv-hero-secondary">{formatUSDC(amount)}</p>
      </div>

      {stage === "unlock" ? (
        <div className="vv-card">
          <div>
            <h2 className="vv-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Lock className="vv-icon-sm" />
              {pt ? "Digite seu código de acesso" : "Enter your access code"}
            </h2>
            <p className="vv-desc">
              {pt
                ? "Use o código de 6 dígitos que você recebeu."
                : "The sender shared a 6-digit code with you."}
            </p>
          </div>
          <div className="vv-field" style={{ marginBottom: 0 }}>
            <label className="vv-label" htmlFor="vv-access-code">
              {pt ? "Código de 6 dígitos" : "6-digit code"}
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
              {pt ? `Usar código de demonstração (${code})` : `Use demo code (${code})`}
            </button>
          ) : showDemoCodeHint ? (
            <p className="vv-hint">
              {pt ? "Demonstração: use o código compartilhado por quem enviou." : "Demo mode: use the access code the sender shared."}
            </p>
          ) : null}
          {error ? <p className="vv-error">{error}</p> : null}
          <button type="button" className="vv-btn" onClick={handleUnlock}>
            {pt ? "Continuar" : "Unlock my payout"}
          </button>
        </div>
      ) : null}

      {stage === "choose" ? (
        <div className="vv-card">
          <div>
            <h2 className="vv-title">{pt ? "Como você quer receber?" : "How do you want your money?"}</h2>
            <p className="vv-desc">{pt ? "O PIX já vem selecionado para você." : "Choose the payout that works for you."}</p>
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
                  {pt ? "Receber por PIX" : "Instant bank via PIX"}
                </span>
                <span className="vv-muted" style={{ fontSize: "0.75rem" }}>
                  {pt ? "Direto na sua conta bancária" : "Cash into your Brazilian bank account"}
                </span>
              </span>
              <span className="vv-rail-eta">{pt ? "Até 2 min" : "Under 2 min"}</span>
            </button>
            <details className="vv-disclosure">
              <summary>
                <ChevronDown className="vv-icon-sm" />
                {pt ? "Opções avançadas" : "Advanced options"}
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
                    {pt ? "Receber em moeda digital (USDC)" : "Keep as USDC"}
                  </span>
                  <span className="vv-muted" style={{ fontSize: "0.75rem" }}>
                    {pt ? "Para quem já usa uma carteira digital" : "Send to a digital wallet"}
                  </span>
                </span>
              </button>
            </details>
          </div>
          {rail === "stellar" ? (
            <div className="vv-field">
              <label className="vv-label" htmlFor="vv-wallet">
                {pt ? "Endereço da carteira digital" : "Wallet address"}
              </label>
              <input
                id="vv-wallet"
                className="vv-input"
                style={{ fontFamily: "var(--vv-mono)" }}
                placeholder={pt ? "Cole o endereço da sua carteira" : "Paste your wallet address"}
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
              />
            </div>
          ) : null}
          {error ? <p className="vv-error">{error}</p> : null}
          <button type="button" className="vv-btn" onClick={handleContinue}>
            {pt ? "Continuar" : "Continue"}
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
          onStatus={onStatus}
          onPaid={(info) => onClaimed?.({ txHash: info.txHash, status: info.status })}
        />
      ) : null}

      {stage === "stellar-processing" ? (
        <div className="vv-card">
          <h2 className="vv-title">{pt ? "Enviando seu dinheiro" : "Sending your money"}</h2>
          <p className="vv-desc">{pt ? "Transferindo para sua carteira digital…" : "Sending to your digital wallet…"}</p>
        </div>
      ) : null}

      {stage === "stellar-done" ? (
        <div className="vv-card">
          <h2 className="vv-title">{pt ? "Dinheiro enviado!" : "Money on the way!"}</h2>
          <p className="vv-desc">
            {pt
              ? `${formatUSDC(amount)} foi enviado para sua carteira digital.`
              : `${formatUSDC(amount)} is being sent to your digital wallet.`}
          </p>
          {txHash ? (
            <div className="vv-row">
              <span className="vv-muted">{pt ? "Transação Stellar" : "Stellar transaction"}</span>
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

      {stage === "failed" && failure ? (
        <div className="vv-card">
          <div>
            <h2 className="vv-title">
              {(pt ? FAILURE_COPY_PT : FAILURE_COPY)[failure.code].title}
            </h2>
            <p className="vv-desc">
              {(pt ? FAILURE_COPY_PT : FAILURE_COPY)[failure.code].body}
            </p>
            {!pt ? <p className="vv-error" style={{ marginTop: 8 }}>{failure.message}</p> : null}
          </div>
          {txHash ? (
            <div className="vv-row">
              <span className="vv-muted">{pt ? "Transação Stellar" : "Stellar transaction"}</span>
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
            {(pt ? FAILURE_COPY_PT : FAILURE_COPY)[failure.code].action}
          </button>
        </div>
      ) : null}
    </div>
  )
}
