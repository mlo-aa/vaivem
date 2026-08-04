"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Building2,
  Lock,
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
import { formatBRL, formatDisplay, formatUSDC, maskEmail } from "@/lib/format"
import { getPixQuote, initiatePixWithdrawal } from "@/lib/services"
import { saveClaim } from "@/lib/claim-store"
import type { Claim, PixKeyType, Quote } from "@/lib/types"

type Rail = "pix" | "stellar"
type Stage = "unlock" | "choose" | "cashout" | "processing" | "done"

const DEMO_CODE = "482913"

export function ClaimFlow({ claim: initialClaim }: { claim: Claim }) {
  const router = useRouter()
  const [claim, setClaim] = useState<Claim>(initialClaim)
  const [stage, setStage] = useState<Stage>("unlock")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [rail, setRail] = useState<Rail>("pix")

  // PIX fields
  const [fullName, setFullName] = useState(initialClaim.recipientName)
  const [cpf, setCpf] = useState("")
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>("cpf")
  const [pixKey, setPixKey] = useState("")
  // Stellar field
  const [walletAddress, setWalletAddress] = useState("")

  const [pixQuote, setPixQuote] = useState<Quote | null>(null)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [processStep, setProcessStep] = useState(0)

  const senderLabel = "Aurora Studios"
  const expired = claim.status === "expired" || claim.status === "refunded" || claim.status === "cancelled"
  const alreadyClaimed = claim.status === "completed" || claim.status === "claimed"
  const requiresCode = claim.protectionType === "code"

  const localAmount = useMemo(
    () => formatDisplay(claim.displayAmount, claim.displayCurrency),
    [claim],
  )

  // Fetch a live PIX quote when the recipient reaches cash-out with PIX selected.
  useEffect(() => {
    let active = true
    if (stage === "cashout" && rail === "pix" && !pixQuote) {
      setLoadingQuote(true)
      getPixQuote(claim.amount).then((q) => {
        if (active) {
          setPixQuote(q)
          setLoadingQuote(false)
        }
      })
    }
    return () => {
      active = false
    }
  }, [stage, rail, pixQuote, claim.amount])

  function handleUnlock() {
    setError(null)
    if (requiresCode && code !== DEMO_CODE) {
      setError("That code doesn't match. Try the demo code below.")
      return
    }
    setStage("choose")
  }

  async function handleClaim() {
    setError(null)
    if (rail === "pix") {
      if (pixKey.trim().length < 4) {
        setError("Enter a valid PIX key.")
        return
      }
      if (!pixQuote) return
      setStage("processing")
      const payout = await initiatePixWithdrawal(
        {
          fullName,
          cpf: cpf || "000.000.000-00",
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
            Contact {senderLabel} and ask them to send you a new ClaimLink.
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
              Secured by ClaimLink escrow on Stellar
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
            <Button className="w-full" size="lg" onClick={() => setStage("cashout")}>
              Continue
              <ArrowRight data-icon="inline-end" />
            </Button>
          </CardFooter>
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
                      placeholder={pixKeyType === "email" ? "you@email.com" : "Your PIX key"}
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
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">You receive</dt>
                <dd className="font-medium text-foreground">
                  {rail === "stellar" ? (
                    formatUSDC(claim.amount)
                  ) : loadingQuote || !pixQuote ? (
                    <Skeleton className="h-4 w-20" />
                  ) : (
                    formatBRL(pixQuote.destinationAmount)
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Fee</dt>
                <dd className="font-medium text-brand">Paid by sender</dd>
              </div>
            </dl>
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
                : pixQuote
                  ? formatBRL(pixQuote.destinationAmount)
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
                : `${pixQuote ? formatBRL(pixQuote.destinationAmount) : localAmount} is landing in your account now.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium text-foreground">
                  {rail === "stellar"
                    ? formatUSDC(claim.amount)
                    : pixQuote
                      ? formatBRL(pixQuote.destinationAmount)
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
                Create your own ClaimLink and pay anyone with just a link.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex-col gap-2">
            {rail === "stellar" ? (
              <Button className="w-full" size="lg" onClick={() => router.push("/wallet")}>
                <Wallet data-icon="inline-start" />
                Open my wallet
              </Button>
            ) : (
              <Button className="w-full" size="lg" onClick={() => router.push("/signup")}>
                Create a free ClaimLink account
              </Button>
            )}
            <Button variant="ghost" className="w-full" onClick={() => router.push("/")}>
              Done
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
