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
import { isBelowMinimum, minAmountInFiat, minAmountMessage, MIN_AMOUNT_USDC } from "./limits"
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
  /** Standalone ramp defaults to English; ClaimLink passes pt-BR. */
  locale?: "pt-BR" | "en"
}

const PIX_KEY_LABEL: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "Email",
  phone: "Phone",
  random: "Random key",
}

const PIX_KEY_LABEL_PT: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "e-mail",
  phone: "telefone",
  random: "chave aleatória",
}

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
    body: "The bank transfer could not be completed. Try again or contact the sender.",
    action: "Try again",
  },
  insufficient_balance: {
    title: "Sender out of funds",
    body: "The sender wallet does not have enough USDC right now.",
    action: "Close",
  },
  stuck_funded: {
    title: "Still processing",
    body: "Your payout was submitted but is not confirmed yet. Check back shortly.",
    action: "Check status later",
  },
  payout_failed: {
    title: "Payout failed",
    body: "Something went wrong sending your money. You can try again.",
    action: "Try again",
  },
  network: {
    title: "Connection problem",
    body: "We could not reach the payout service. Check your connection and try again.",
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
    body: "Confira os dados da chave PIX ou tente novamente mais tarde.",
    action: "Tentar novamente",
  },
  insufficient_balance: {
    title: "A conta de envio está sem saldo",
    body: "A pessoa que enviou precisa adicionar saldo antes de você tentar novamente.",
    action: "Fechar",
  },
  stuck_funded: {
    title: "Ainda estamos processando",
    body: "O envio foi iniciado, mas ainda não foi confirmado. Consulte novamente em alguns minutos.",
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

function validatePixKey(type: PixKeyType, key: string, pt: boolean): string | null {
  const v = key.trim()
  if (!v) return pt ? "Digite sua chave PIX." : "Enter your PIX key."
  switch (type) {
    case "cpf":
      return digitsOnly(v).length === 11 ? null : pt ? "O CPF deve ter 11 dígitos." : "CPF must have 11 digits."
    case "cnpj":
      return digitsOnly(v).length === 14 ? null : pt ? "O CNPJ deve ter 14 dígitos." : "CNPJ must have 14 digits."
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : pt ? "Digite um e-mail válido." : "Enter a valid email PIX key."
    case "phone":
      return digitsOnly(v).length >= 10 ? null : pt ? "Digite um telefone válido." : "Enter a valid phone PIX key."
    case "random":
      return v.length >= 8 ? null : pt ? "A chave aleatória deve ter pelo menos 8 caracteres." : "Random keys are at least 8 characters."
    default:
      return null
  }
}

type Stage = "kyc" | "cashout" | "processing" | "done" | "failed"

export function RampWithdraw({
  amount,
  country = "BR",
  onPaid,
  onFailed,
  onStatus,
  apiBaseUrl = "",
  claimToken,
  accessCode,
  locale = "en",
}: RampWithdrawProps) {
  const [stage, setStage] = useState<Stage>("kyc")
  const [error, setError] = useState<string | null>(null)
  const [failure, setFailure] = useState<{ code: PayoutFailureCode; message: string } | null>(
    null,
  )

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
  const [txHash, setTxHash] = useState<string | null>(null)
  const pt = locale === "pt-BR"

  // Checked before any request goes out — the provider rejects sub-minimum amounts.
  const belowMinimum = isBelowMinimum(amount)

  const quoteEnabled = stage === "cashout" || stage === "processing" || stage === "done"
  const { quote, loading, error: quoteError, errorKind, refresh, secondsLeft } = useQuote(
    amount,
    country,
    {
      apiBaseUrl,
      enabled: quoteEnabled && kycStatus === "approved" && !belowMinimum,
    },
  )

  const brlAmount = quote ? Number(quote.destinationAmount) : null
  const minimumMessage = minAmountMessage(
    country,
    quote ? Number(quote.etherfuseMidMarketRate) : null,
  )
  const localizedMinimumMessage = pt
    ? `O valor mínimo é ${formatUSDC(MIN_AMOUNT_USDC)} — cerca de ${minAmountInFiat(
        country,
        quote ? Number(quote.etherfuseMidMarketRate) : null,
      )} na cotação atual.`
    : minimumMessage
  const canPay = !belowMinimum && !quoteError && !loading && Boolean(quote)
  const displayedQuoteError =
    pt && quoteError
      ? errorKind === "network"
        ? "Não foi possível consultar a cotação. Confira sua internet e tente novamente."
        : errorKind === "provider"
          ? "O serviço de cotação está indisponível no momento. Tente novamente."
          : quoteError
      : quoteError

  async function handleSubmitKyc() {
    setError(null)
    if (kycName.trim().length < 2) {
      setError(pt ? "Digite seu nome completo." : "Enter your full legal name.")
      return
    }
    const idLen = digitsOnly(kycTaxId).length
    if (idLen !== 11 && idLen !== 14) {
      setError(pt ? "Digite um CPF (11 dígitos) ou CNPJ (14 dígitos) válido." : "Enter a valid CPF (11 digits) or CNPJ (14 digits).")
      return
    }
    if (!kycDob) {
      setError(pt ? "Digite sua data de nascimento." : "Enter your date of birth.")
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
      setError(pt ? "Não foi possível validar os dados. Confira e tente novamente." : "We couldn't verify that identity. Check the details and try again.")
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
    const keyError = validatePixKey(pixKeyType, pixKey, pt)
    if (keyError) {
      setError(keyError)
      return
    }
    if (!quote || secondsLeft <= 0) {
      void refresh({ force: true })
      setError(pt ? "A cotação venceu. Atualizamos o valor — confira antes de continuar." : "Your quote expired. We refreshed it — confirm the new amount.")
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

      const payout = await executePixPayout(amount, apiBaseUrl, (s) => setProcessStep(s))
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
        fail("network", err instanceof Error ? err.message : "Payout failed")
      }
    }
  }

  return (
    <div className="vv-kit">
      {stage === "kyc" ? (
        <div className="vv-card">
          <div>
            <div className="vv-heading-row">
              <h2 className="vv-title">
                {pt ? "Validação para demonstração" : "Demo verification"}
              </h2>
              <span className="vv-demo-badge">{pt ? "DEMO" : "DEMO"}</span>
            </div>
            <p className="vv-desc">
              {pt
                ? "Nesta versão, validamos apenas o formato do CPF ou CNPJ. Não é uma consulta a bases oficiais."
                : "This version only validates the CPF/CNPJ format. It does not check an official registry."}
            </p>
          </div>
          {kycSubmitting ? (
            <ProcessSteps
              current={kycStep}
              steps={
                pt
                  ? ["Recebendo seus dados", "Validando o formato", "Liberando a demonstração"]
                  : ["Receiving your details", "Validating the format", "Opening the demo payout"]
              }
            />
          ) : (
            <div>
              <div className="vv-field">
                <label className="vv-label" htmlFor="vv-kyc-name">
                  {pt ? "Nome completo" : "Full legal name"}
                </label>
                <input
                  id="vv-kyc-name"
                  className="vv-input"
                  value={kycName}
                  onChange={(e) => setKycName(e.target.value)}
                  placeholder={pt ? "Como aparece no documento" : "As it appears on your ID"}
                />
              </div>
              <div className="vv-field">
                <label className="vv-label" htmlFor="vv-kyc-tax">
                  {pt ? "CPF ou CNPJ" : "CPF or CNPJ"}
                </label>
                <input
                  id="vv-kyc-tax"
                  className="vv-input"
                  value={kycTaxId}
                  onChange={(e) => setKycTaxId(e.target.value)}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                />
                <span className="vv-hint">
                  {pt ? "Pessoa física usa CPF; empresa usa CNPJ." : "Individuals use CPF; businesses use CNPJ."}
                </span>
              </div>
              <div className="vv-field">
                <label className="vv-label" htmlFor="vv-kyc-dob">
                  {pt ? "Data de nascimento" : "Date of birth"}
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
              {pt ? "Validar e continuar" : "Verify and continue"}
            </button>
          ) : null}
        </div>
      ) : null}

      {stage === "cashout" ? (
        <div className="vv-card">
          <div>
            <h2 className="vv-title">{pt ? "Onde você quer receber?" : "Where should we send it?"}</h2>
            <p className="vv-desc">
              {pt ? "Digite sua chave PIX. O dinheiro vai direto para sua conta." : `Enter your PIX key to receive ${formatUSDC(amount)} as BRL.`}
            </p>
          </div>
          <div>
            <div className="vv-field">
              <label className="vv-label" htmlFor="vv-pix-type">
                {pt ? "Tipo de chave PIX" : "PIX key type"}
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
                <option value="phone">{pt ? "Telefone" : "Phone"}</option>
                <option value="random">{pt ? "Chave aleatória" : "Random key"}</option>
              </select>
            </div>
            <div className="vv-field">
              <label className="vv-label" htmlFor="vv-pix-key">
                {pt ? "Chave PIX" : "PIX key"}
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
                      : pt
                        ? `Sua ${PIX_KEY_LABEL_PT[pixKeyType]}`
                        : `Your ${PIX_KEY_LABEL[pixKeyType]}`
                }
              />
              <span className="vv-hint">
                {pt ? "O valor costuma cair na conta em até 2 minutos." : "Funds arrive in your bank in under 2 minutes."}
              </span>
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
                  <span className="vv-muted">{pt ? "Você recebe" : "You receive"}</span>
                  <span className="vv-strong">{formatBRL(brlAmount ?? 0)}</span>
                </div>
                <div className="vv-countdown">
                  <span
                    className="vv-muted"
                    style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
                  >
                    <RefreshCw className="vv-icon-sm" />
                    {pt ? "Cotação atualiza em" : "Quote refreshes in"}
                  </span>
                  <span className="vv-mono vv-strong">
                    {String(Math.floor(secondsLeft / 60)).padStart(1, "0")}:
                    {String(secondsLeft % 60).padStart(2, "0")}
                  </span>
                </div>
                <details className="vv-disclosure vv-disclosure--rates">
                  <summary>
                    <ChevronDown className="vv-icon-sm" />
                    {pt ? "Detalhes" : "Details"}
                  </summary>
                  <div className="vv-stack">
                    <div className="vv-row">
                      <span className="vv-muted">{pt ? "Cotação Etherfuse" : "Etherfuse rate"}</span>
                      <span className="vv-mono">
                        1 USDC = {Number(quote.exchangeRate).toFixed(4)} BRL
                      </span>
                    </div>
                    <div className="vv-row">
                      <span className="vv-muted">{pt ? "Cotação de mercado" : "Mid-market"}</span>
                      <span className="vv-mono">
                        1 USDC = {Number(quote.etherfuseMidMarketRate).toFixed(4)} BRL
                      </span>
                    </div>
                    <div className="vv-row">
                      <span className="vv-muted">
                        {pt ? "Tarifa" : "Provider fee"} ({(Number(quote.feeBps) / 100).toFixed(2)}%)
                      </span>
                      <span className="vv-mono">{formatUSDC(Number(quote.feeAmount))}</span>
                    </div>
                  </div>
                </details>
              </div>
              <p className={quote.source === "mock" ? "vv-note vv-note--amber" : "vv-note"}>
                {quote.source === "mock"
                  ? pt
                    ? "Cotação simulada — serviço ao vivo indisponível"
                    : "Simulated quote — live provider unavailable"
                  : pt
                    ? "Cotação ao vivo no ambiente de testes"
                    : "Live quote from Etherfuse sandbox"}
              </p>
            </>
          )}

          {error ? <p className="vv-error">{error}</p> : null}
          {brlAmount !== null ? (
            <p className="vv-expectation">
              {pt
                ? `${formatBRL(brlAmount)} deve chegar na sua chave PIX em até 2 minutos.`
                : `${formatBRL(brlAmount)} should reach your PIX key in under 2 minutes.`}
            </p>
          ) : null}

          <button
            type="button"
            className="vv-btn"
            onClick={handlePay}
            disabled={!canPay}
          >
            {pt ? "Confirmar recebimento de" : "Claim"}{" "}
            {brlAmount !== null ? formatBRL(brlAmount) : formatUSDC(amount)}
          </button>
        </div>
      ) : null}

      {stage === "processing" ? (
        <div className="vv-card">
          <div>
            <h2 className="vv-title">{pt ? "Enviando seu dinheiro" : "Sending your money"}</h2>
            <p className="vv-desc">
              {pt ? "Previsão: até 2 minutos. Você pode aguardar nesta tela." : "ETA: under 2 minutes. You can wait on this screen."}
            </p>
          </div>
          <ProcessSteps
            current={processStep}
            steps={
              pt
                ? ["Confirmando seus dados", "Enviando para sua chave PIX", "Confirmando o depósito"]
                : ["Confirming your details", "Sending to your PIX key", "Confirming the deposit"]
            }
          />
        </div>
      ) : null}

      {stage === "done" ? (
        <div className="vv-card">
          <div>
            <h2 className="vv-title">{pt ? "Dinheiro enviado!" : "Money on the way!"}</h2>
            <p className="vv-desc">
              {pt
                ? `${brlAmount !== null ? formatBRL(brlAmount) : formatUSDC(amount)} está chegando na sua conta.`
                : `${brlAmount !== null ? formatBRL(brlAmount) : formatUSDC(amount)} is landing in your account now.`}
            </p>
          </div>
          {reference ? (
            <div className="vv-row">
              <span className="vv-muted">{pt ? "Pedido PIX" : "PIX order"}</span>
              <span className="vv-mono" style={{ fontSize: 12, wordBreak: "break-all", textAlign: "right" }}>
                {reference}
              </span>
            </div>
          ) : null}
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
          {reference ? (
            <div className="vv-row">
              <span className="vv-muted">{pt ? "Pedido PIX" : "PIX order"}</span>
              <span className="vv-mono" style={{ fontSize: 12, wordBreak: "break-all", textAlign: "right" }}>
                {reference}
              </span>
            </div>
          ) : null}
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
          <button
            type="button"
            className="vv-btn"
            onClick={() => {
              setFailure(null)
              setStage("cashout")
            }}
          >
            {(pt ? FAILURE_COPY_PT : FAILURE_COPY)[failure.code].action}
          </button>
        </div>
      ) : null}
    </div>
  )
}
