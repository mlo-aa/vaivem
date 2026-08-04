"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Building2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ProcessSteps } from "@/components/process-steps"
import { formatBRL, formatUSDC, formatDisplay, maskEmail } from "@/lib/format"
import { getPixQuote, initiatePixWithdrawal, submitKyc } from "@/lib/services"
import { saveClaim } from "@/lib/claim-store"
import type { Claim, KycStatus, PixKeyType, Quote } from "@/lib/types"

type Rail = "pix" | "stellar"
type Stage = "unlock" | "choose" | "kyc" | "cashout" | "processing" | "done"

const DEMO_CODE = "482913"

// PIX key validators keyed by type. Kept intentionally lightweight for the demo.
function digitsOnly(v: string) {
  return v.replace(/\D/g, "")
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

const PIX_KEY_LABEL: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "Email",
  phone: "Phone",
  random: "Random key",
}

export function ClaimFlow({ claim: initialClaim }: { claim: Claim }) {
  const router = useRouter()
  const [claim, setClaim] = useState<Claim>(initialClaim)
  const [stage, setStage] = useState<Stage>("unlock")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [rail, setRail] = useState<Rail>("pix")

  // KYC fields
  const [kycStatus, setKycStatus] = useState<KycStatus>(initialClaim.kycStatus ?? "not_started")
  const [kycName, setKycName] = useState(initialClaim.recipientName)
  const [kycTaxId, setKycTaxId] = useState("")
  const [kycDob, setKycDob] = useState("")
  const [kycStep, setKycStep] = useState(0)
  const [kycSubmitting, setKycSubmitting] = useState(false)

  // PIX fields
  const [fullName, setFullName] = useState(initialClaim.recipientName)
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>("cpf")
  const [pixKey, setPixKey] = useState("")
  // Stellar field
  const [walletAddress, setWalletAddress] = useState("")

  const [pixQuote, setPixQuote] = useState<Quote | null>(null)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [processStep, setProcessStep] = useState(0)

  const senderLabel = "Aurora Studios"
  const expired = claim.status === "expired" || claim.status === "refunded" || claim.status === "cancelled"
  const alreadyClaimed = claim.status === "completed" || claim.status === "claimed"
  const requiresCode = claim.protectionType === "code"

  const localAmount = useMemo(
    () => formatDisplay(claim.displayAmount, claim.displayCurrency),
    [claim],
  )

  const brlAmount = pixQuote ? Number(pixQuote.destinationAmount) : null

  // Fetch (or refresh) a live PIX quote. Etherfuse quotes are valid 2 minutes.
  const refreshQuote = useCallback(async () => {
    setLoadingQuote(true)
    const q = await getPixQuote(claim.amount)
    setPixQuote(q)
    setLoadingQuote(false)
  }, [claim.amount])

  // Load the first quote when the recipient reaches PIX cash-out.
  useEffect(() => {
    if (stage === "cashout" && rail === "pix" && !pixQuote && !loadingQuote) {
      void refreshQuote()
    }
  }, [stage, rail, pixQuote, loadingQuote, refreshQuote])

  // Drive the countdown off the quote's expiry and auto-refresh when it lapses.
  useEffect(() => {
    if (stage !== "cashout" || rail !== "pix" || !pixQuote) return
    const tick = () => {
      const diff = new Date(pixQuote.expiresAt).getTime() - Date.now()
      const s = Math.max(0, Math.floor(diff / 1000))
      setSecondsLeft(s)
      if (s <= 0 && !loadingQuote) void refreshQuote()
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [stage, rail, pixQuote, loadingQuote, refreshQuote])

  function handleUnlock() {
    setError(null)
    if (requiresCode && code !== DEMO_CODE) {
      setError("That code doesn't match. Try the demo code below.")
      return
    }
    setStage("choose")
  }

  // PIX requires an approved KYC record before we can settle to a bank.
  function handleContinueFromChoose() {
    setError(null)
    if (rail === "pix" && kycStatus !== "approved") {
      setStage("kyc")
    } else {
      setStage("cashout")
    }
  }

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
      setClaim((c) => ({ ...c, kycStatus: "approved" }))
      setStage("cashout")
    } else {
      setError("We couldn't verify that identity. Check the details and try again.")
    }
  }

  async function handleClaim() {
    setError(null)
    if (rail === "pix") {
      const keyError = validatePixKey(pixKeyType, pixKey)
      if (keyError) {
        setError(keyError)
        return
      }
      if (!pixQuote || secondsLeft <= 0) {
        void refreshQuote()
        setError("Your quote expired. We refreshed it — confirm the new amount.")
        return
      }
      setStage("processing")
      const payout = await initiatePixWithdrawal(
        {
          fullName,
          cpf: kycTaxId || "000.000.000-00",
          pixKeyType,
          pixKey,
          amountUSDC: claim.amount,
        },
        pixQuote,
        (s) => setProcessStep(s),
      )
      setClaim((c) => {
        const next: Claim = {
          ...c,
          status: "completed",
          payoutMethod: "pix",
          claimedAt: new Date().toISOString(),
          withdrawalReference: payout.reference,
        }
        saveClaim(next)
        return next
      })
      setStage("done")
      return
    }
    // Stellar wallet keep
    if (walletAddress.trim().length < 8) {
      setError("Enter a valid Stellar wallet address.")
      return
    }
    setStage("processing")
    for (let i = 1; i <= 3; i++) {
      await new Promise((r) => setTimeout(r, 750))
      setProcessStep(i)
    }
    setClaim((c) => {
      const next: Claim = {
        ...c,
        status: "completed",
        payoutMethod: "stellar",
        claimedAt: new Date().toISOString(),
      }
      saveClaim(next)
      return next
    })
    setStage("done")
  }

  if (expired) {
    return (
      <StatusCard
        title="This link is no longer available"
        description={
          claim.status === "refunded"
            ? "The sender has refunded this payout."
            : claim.status === "cancelled"
              ? "The sender cancelled this payout."
              : "This claim link has expired."
        }
      >
        <Alert>
          <ShieldCheck />
          <AlertTitle>Need the funds?</AlertTitle>
          <AlertDescription>
            Contact {senderLabel} and ask them to send you a new claim link.
          </AlertDescription>
        </Alert>
      </StatusCard>
    )
  }

  if (alreadyClaimed && stage === "unlock") {
    return (
      <StatusCard
        title="Already claimed"
        description="This payout has already been collected."
      >
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-medium text-foreground">{localAmount}</span>
          </div>
        </div>
      </StatusCard>
    )
  }

  return (
    <div className="mx-auto w-full max-w-md">
      {/* Amount hero */}
      <div className="mb-6 text-center">
        <p className="text-sm text-muted-foreground">{senderLabel} sent you</p>
        <p className="mt-1 font-mono text-5xl font-semibold tracking-tight text-foreground">
          {localAmount}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{formatUSDC(claim.amount)}</p>
        {claim.message ? (
          <p className="mx-auto mt-4 max-w-xs text-pretty rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
            {"\u201C"}
            {claim.message}
            {"\u201D"}
          </p>
        ) : null}
      </div>

      {stage === "unlock" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="size-4 text-brand" />
              {requiresCode ? "Enter your access code" : "Verify it's you"}
            </CardTitle>
            <CardDescription>
              {requiresCode
                ? "The sender shared a 6-digit code with you."
                : claim.recipientEmail
                  ? `We'll confirm this payout for ${maskEmail(claim.recipientEmail)}.`
                  : "Confirm your details to unlock this payout."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {requiresCode ? (
              <div className="flex flex-col items-center gap-3">
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => setCode(DEMO_CODE)}
                >
                  Use demo code ({DEMO_CODE})
                </button>
              </div>
            ) : (
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="confirm-name">Your full name</FieldLabel>
                  <Input
                    id="confirm-name"
                    placeholder={claim.recipientName}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                  <FieldDescription>Must match the name the sender entered.</FieldDescription>
                </Field>
              </FieldGroup>
            )}
            {error ? (
              <p className="mt-3 text-center text-sm text-destructive">{error}</p>
            ) : null}
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button className="w-full" size="lg" onClick={handleUnlock}>
              Unlock my payout
              <ArrowRight data-icon="inline-end" />
            </Button>
            <p className="flex items-center gap-1.5 text-center text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" />
              Secured by Vaivém escrow on Stellar
            </p>
          </CardFooter>
        </Card>
      ) : null}

      {stage === "choose" ? (
        <Card>
          <CardHeader>
            <CardTitle>How do you want your money?</CardTitle>
            <CardDescription>Choose the payout that works for you.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <RailOption
                selected={rail === "pix"}
                onSelect={() => setRail("pix")}
                icon={Banknote}
                label="Instant bank via PIX"
                desc="Cash into your Brazilian bank account"
                eta="Under 2 min"
              />
              <RailOption
                selected={rail === "stellar"}
                onSelect={() => setRail("stellar")}
                icon={Wallet}
                label="Keep as USDC"
                desc="Send to a Stellar wallet address"
                eta="Instant"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" size="lg" onClick={handleContinueFromChoose}>
              Continue
              <ArrowRight data-icon="inline-end" />
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {stage === "kyc" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BadgeCheck className="size-4 text-brand" />
              Verify your identity
            </CardTitle>
            <CardDescription>
              Brazilian regulations require a quick identity check before a PIX
              cash-out. This is a one-time step.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {kycSubmitting ? (
              <ProcessSteps
                current={kycStep}
                steps={["Submitting details", "Checking against registry", "Approving payout"]}
              />
            ) : (
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="kyc-name">Full legal name</FieldLabel>
                  <Input
                    id="kyc-name"
                    value={kycName}
                    onChange={(e) => setKycName(e.target.value)}
                    placeholder="As it appears on your ID"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="kyc-taxid">CPF or CNPJ</FieldLabel>
                  <Input
                    id="kyc-taxid"
                    value={kycTaxId}
                    onChange={(e) => setKycTaxId(e.target.value)}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                  />
                  <FieldDescription>Individuals use CPF; businesses use CNPJ.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="kyc-dob">Date of birth</FieldLabel>
                  <Input
                    id="kyc-dob"
                    type="date"
                    value={kycDob}
                    onChange={(e) => setKycDob(e.target.value)}
                  />
                </Field>
              </FieldGroup>
            )}
            {error ? (
              <p className="mt-3 text-center text-sm text-destructive">{error}</p>
            ) : null}
          </CardContent>
          {!kycSubmitting ? (
            <CardFooter className="flex-col gap-2">
              <Button className="w-full" size="lg" onClick={handleSubmitKyc}>
                Verify and continue
                <ArrowRight data-icon="inline-end" />
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => { setError(null); setStage("choose") }}>
                Back
              </Button>
            </CardFooter>
          ) : null}
        </Card>
      ) : null}

      {stage === "cashout" ? (
        <Card>
          <CardHeader>
            <CardTitle>{rail === "pix" ? "Where should we send it?" : "Your Stellar wallet"}</CardTitle>
            <CardDescription>
              {rail === "pix"
                ? "Enter your PIX key to receive funds instantly."
                : "Paste a Stellar USDC wallet address."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              {rail === "pix" ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="pix-type">PIX key type</FieldLabel>
                    <Select value={pixKeyType} onValueChange={(v) => setPixKeyType(v as PixKeyType)}>
                      <SelectTrigger id="pix-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="cpf">CPF</SelectItem>
                          <SelectItem value="cnpj">CNPJ</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="phone">Phone</SelectItem>
                          <SelectItem value="random">Random key</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="pix-key">PIX key</FieldLabel>
                    <Input
                      id="pix-key"
                      placeholder={
                        pixKeyType === "email"
                          ? "you@email.com"
                          : pixKeyType === "phone"
                            ? "+55 11 90000-0000"
                            : `Your ${PIX_KEY_LABEL[pixKeyType]}`
                      }
                      value={pixKey}
                      onChange={(e) => setPixKey(e.target.value)}
                    />
                    <FieldDescription>Funds arrive in your bank in under 2 minutes.</FieldDescription>
                  </Field>
                </>
              ) : (
                <Field>
                  <FieldLabel htmlFor="wallet">Wallet address</FieldLabel>
                  <Input
                    id="wallet"
                    placeholder="G… Stellar address"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <FieldDescription>
                    Double-check the address — transfers can&apos;t be reversed.
                  </FieldDescription>
                </Field>
              )}
            </FieldGroup>

            <Separator className="my-4" />
            {rail === "stellar" ? (
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">You receive</dt>
                  <dd className="font-medium text-foreground">{formatUSDC(claim.amount)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Network fee</dt>
                  <dd className="font-medium text-brand">Sponsored</dd>
                </div>
              </dl>
            ) : loadingQuote || !pixQuote ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : (
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">You receive</dt>
                  <dd className="font-semibold text-foreground">{formatBRL(brlAmount ?? 0)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Etherfuse rate</dt>
                  <dd className="tabular-nums text-foreground">
                    1 USDC = {Number(pixQuote.exchangeRate).toFixed(4)} BRL
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">
                    Provider fee ({(Number(pixQuote.feeBps) / 100).toFixed(2)}%)
                  </dt>
                  <dd className="tabular-nums text-foreground">
                    {formatUSDC(Number(pixQuote.feeAmount))}
                  </dd>
                </div>
                <div className="mt-1 flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <RefreshCw className={`size-3.5 ${loadingQuote ? "animate-spin" : ""}`} />
                    Quote refreshes in
                  </dt>
                  <dd className="font-mono font-medium tabular-nums text-foreground">
                    {String(Math.floor(secondsLeft / 60)).padStart(1, "0")}:
                    {String(secondsLeft % 60).padStart(2, "0")}
                  </dd>
                </div>
              </dl>
            )}
            {error ? (
              <p className="mt-3 text-center text-sm text-destructive">{error}</p>
            ) : null}
          </CardContent>
          <CardFooter className="flex-col gap-2">
            <Button
              className="w-full"
              size="lg"
              onClick={handleClaim}
              disabled={rail === "pix" && (loadingQuote || !pixQuote)}
            >
              <BadgeCheck data-icon="inline-start" />
              Claim{" "}
              {rail === "stellar"
                ? formatUSDC(claim.amount)
                : brlAmount !== null
                  ? formatBRL(brlAmount)
                  : localAmount}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setError(null)
                setStage("choose")
              }}
            >
              Back
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {stage === "processing" ? (
        <Card>
          <CardHeader>
            <CardTitle>Sending your money</CardTitle>
            <CardDescription>This usually takes a few seconds.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProcessSteps
              current={processStep}
              steps={
                rail === "pix"
                  ? [
                      "Releasing funds from escrow",
                      "Converting USDC to BRL",
                      "Sending PIX transfer",
                      "Confirming deposit",
                    ]
                  : [
                      "Releasing funds from escrow",
                      "Broadcasting on Stellar",
                      "Confirming transaction",
                    ]
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {stage === "done" ? (
        <Card className="border-brand/40">
          <CardHeader className="items-center text-center">
            <span className="mb-2 flex size-14 items-center justify-center rounded-full bg-brand/15 text-brand">
              <Sparkles className="size-7" />
            </span>
            <CardTitle>Money on the way!</CardTitle>
            <CardDescription>
              {rail === "stellar"
                ? `${formatUSDC(claim.amount)} is being sent to your Stellar wallet.`
                : `${brlAmount !== null ? formatBRL(brlAmount) : localAmount} is landing in your account now.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium text-foreground">
                  {rail === "stellar"
                    ? formatUSDC(claim.amount)
                    : brlAmount !== null
                      ? formatBRL(brlAmount)
                      : localAmount}
                </span>
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Method</span>
                <span className="font-medium text-foreground">
                  {rail === "pix" ? "Instant bank via PIX" : "Kept as USDC"}
                </span>
              </div>
              {claim.withdrawalReference ? (
                <>
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Reference</span>
                    <span className="font-mono text-xs text-foreground">
                      {claim.withdrawalReference}
                    </span>
                  </div>
                </>
              ) : null}
            </div>
            <Alert>
              <Building2 />
              <AlertTitle>Want to send money too?</AlertTitle>
              <AlertDescription>
                Create your own claim link and pay anyone with just a link.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex-col gap-2">
            <Button className="w-full" size="lg" onClick={() => router.push("/")}>
              Explore Vaivém
              <ArrowRight data-icon="inline-end" />
            </Button>
          </CardFooter>
        </Card>
      ) : null}
    </div>
  )
}

function StatusCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
    </Card>
  )
}

function RailOption({
  selected,
  onSelect,
  icon: Icon,
  label,
  desc,
  eta,
}: {
  selected: boolean
  onSelect: () => void
  icon: typeof Wallet
  label: string
  desc: string
  eta: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-selected={selected}
      className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-brand/60 data-[selected=true]:border-brand data-[selected=true]:bg-brand/5"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
        <Icon className="size-5" />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
      <span className="text-xs font-medium text-brand">{eta}</span>
    </button>
  )
}
