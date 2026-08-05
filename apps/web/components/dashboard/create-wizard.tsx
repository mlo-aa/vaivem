'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Globe,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ButtonLink } from '@/components/ui/button-link'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/status-badge'
import { SharePanel } from '@/components/share-panel'
import { ProcessSteps } from '@/components/process-steps'
import { cn } from '@/lib/utils'
import {
  createClaim,
  fundClaim,
  getFundingUsdc,
  type CreateClaimInput,
} from '@/lib/services'
import { formatDisplay, formatUSDC } from '@/lib/format'
import { saveClaim } from '@/lib/claim-store'
  import type { Claim, DisplayCurrency, ProtectionType } from '@/lib/types'

const PURPOSES = [
  'Hackathon prize',
  'Freelancer payment',
  'Community reward',
  'Refund',
  'Grant',
  'Event incentive',
  'Other',
]

const PROTECTION: { value: ProtectionType; label: string; description: string; icon: typeof Globe }[] = [
  {
    value: 'email',
    label: 'Email verification',
    description: 'Recipient confirms a code sent to their email.',
    icon: Mail,
  },
  {
    value: 'code',
    label: 'Access code',
    description: 'Share a private code out-of-band to unlock.',
    icon: Lock,
  },
  {
    value: 'public',
    label: 'Public link',
    description: 'Anyone with the link can claim. Best for open drops.',
    icon: Globe,
  },
]

const FUND_STEPS = [
  'Reserving USDC from balance',
  'Creating claimable balance on Stellar',
  'Sponsoring recipient trustline',
  'Publishing secure claim link',
]

type Stage = 'form' | 'funding' | 'done'

export function CreateWizard() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [stage, setStage] = useState<Stage>('form')

  // form state
  const [amount, setAmount] = useState('500')
  const [currency, setCurrency] = useState<DisplayCurrency>('BRL')
  const [purpose, setPurpose] = useState('Hackathon prize')
  const [reference, setReference] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [protection, setProtection] = useState<ProtectionType>('email')
  const [accessCode, setAccessCode] = useState('')
  const [message, setMessage] = useState('')
  const [expiration, setExpiration] = useState('7')
  const [allowStellar, setAllowStellar] = useState(true)
  const [allowPix, setAllowPix] = useState(true)

  const [fundingUsdc, setFundingUsdc] = useState<number | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [fundStep, setFundStep] = useState(0)
  const [claim, setClaim] = useState<Claim | null>(null)
  const [error, setError] = useState<string | null>(null)

  const numericAmount = Number.parseFloat(amount) || 0
  // Rate is only meaningful when converting from BRL; USD funds 1:1.
  const fundingRate =
    currency === 'BRL' && fundingUsdc && fundingUsdc > 0
      ? numericAmount / fundingUsdc
      : 1

  // Recompute the USDC to lock whenever amount or currency changes (debounced).
  useEffect(() => {
    if (numericAmount <= 0) {
      setFundingUsdc(null)
      return
    }
    setQuoting(true)
    const handle = setTimeout(async () => {
      const usdc = await getFundingUsdc(numericAmount, currency)
      setFundingUsdc(usdc)
      setQuoting(false)
    }, 450)
    return () => clearTimeout(handle)
  }, [numericAmount, currency])

  function validateStep1() {
    if (numericAmount <= 0) return 'Enter an amount greater than zero.'
    if (numericAmount > 100000) return 'Amount exceeds the demo limit of 100,000.'
    if (!allowStellar && !allowPix) return 'Enable at least one payout method.'
    return null
  }

  function validateStep2() {
    if (recipientName.trim().length < 2) return 'Enter the recipient name.'
    if (protection === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail))
      return 'Enter a valid recipient email for email verification.'
    if (protection === 'code' && accessCode.trim().length < 4)
      return 'Access code must be at least 4 characters.'
    return null
  }

  function next() {
    const err = step === 1 ? validateStep1() : validateStep2()
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setStep((s) => s + 1)
  }

  function back() {
    setError(null)
    setStep((s) => s - 1)
  }

  async function handleFund() {
    setError(null)
    setStage('funding')
    const input: CreateClaimInput = {
      amount: numericAmount,
      displayCurrency: currency,
      recipientCountry: 'BR',
      purpose,
      reference: reference || undefined,
      message: message || undefined,
      protectionType: protection,
      recipientName,
      recipientEmail: protection === 'email' ? recipientEmail : undefined,
      accessCode: protection === 'code' ? accessCode : undefined,
      expirationDays: Number.parseInt(expiration, 10),
      allowStellar,
      allowPix,
    }
    const created = await createClaim(input)
    const funded = await fundClaim(created, (s) => setFundStep(s))
    // Link is published and awaiting the recipient -> shared.
    const shared: Claim = { ...funded, status: 'shared' }
    setClaim(shared)
    saveClaim(shared)
    setStage('done')
  }

  if (stage === 'funding') {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col gap-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand/15 text-[color-mix(in_oklab,var(--brand),black_40%)]">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold">Locking funds on Stellar</h2>
              <p className="text-sm text-muted-foreground">
                Securing {formatUSDC(fundingUsdc ?? 0)} for {recipientName}
              </p>
            </div>
          </div>
          <ProcessSteps steps={FUND_STEPS} current={fundStep} />
        </CardContent>
      </Card>
    )
  }

  if (stage === 'done' && claim) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="size-7" />
          </span>
          <div>
            <h2 className="text-xl font-semibold">Your claim link is live</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDisplay(claim.displayAmount, claim.displayCurrency)} is locked and ready to
              share.
            </p>
          </div>
        </div>
        <SharePanel
          token={claim.token}
          amountLabel={formatDisplay(claim.displayAmount, claim.displayCurrency)}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <ButtonLink href={`/dashboard/claims/${claim.token}`} className="flex-1">
            View claim details
          </ButtonLink>
          <Button variant="outline" className="flex-1" onClick={() => router.push('/dashboard')}>
            Back to dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-6">
        <Stepper step={step} />

        {error && (
          <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {step === 1 && (
          <Card>
            <CardContent className="py-2">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="amount">Payout amount</FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      id="amount"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                      className="text-lg font-medium"
                    />
                    <ToggleGroup
                      value={[currency]}
                      onValueChange={(v) => {
                        if (v[0]) setCurrency(v[0] as DisplayCurrency)
                      }}
                    >
                      <ToggleGroupItem value="BRL">BRL</ToggleGroupItem>
                      <ToggleGroupItem value="USD">USD</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  <FieldDescription>
                    Recipients receive USDC and can cash out in local currency.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="purpose">Purpose</FieldLabel>
                  <Select value={purpose} onValueChange={(v) => { if (v != null) setPurpose(v) }}>
                    <SelectTrigger id="purpose">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PURPOSES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="reference">Reference (optional)</FieldLabel>
                  <Input
                    id="reference"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. HACK-2025-1ST"
                  />
                </Field>

                <FieldSet>
                  <FieldLegend>Payout methods offered to recipient</FieldLegend>
                  <FieldGroup className="gap-3">
                    <MethodToggle
                      title="Keep as USDC on Stellar"
                      description="Free sponsored wallet, no cash-out fees."
                      checked={allowStellar}
                      onChange={setAllowStellar}
                    />
                    <MethodToggle
                      title="Cash out via PIX (Brazil)"
                      description="Convert to BRL and withdraw to any PIX key."
                      checked={allowPix}
                      onChange={setAllowPix}
                    />
                  </FieldGroup>
                </FieldSet>
              </FieldGroup>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardContent className="py-2">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="recipient">Recipient name</FieldLabel>
                  <Input
                    id="recipient"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Lucas Ferreira"
                  />
                </Field>

                <FieldSet>
                  <FieldLegend>Protection</FieldLegend>
                  <FieldDescription>
                    Control who can open and claim this link.
                  </FieldDescription>
                  <div className="mt-2 grid gap-2">
                    {PROTECTION.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setProtection(p.value)}
                        className={cn(
                          'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                          protection === p.value
                            ? 'border-brand bg-brand/5 ring-1 ring-brand/30'
                            : 'border-border hover:bg-secondary',
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 flex size-8 items-center justify-center rounded-lg',
                            protection === p.value
                              ? 'bg-brand/15 text-[color-mix(in_oklab,var(--brand),black_40%)]'
                              : 'bg-secondary text-muted-foreground',
                          )}
                        >
                          <p.icon className="size-4" />
                        </span>
                        <span className="flex flex-col">
                          <span className="text-sm font-medium">{p.label}</span>
                          <span className="text-xs text-muted-foreground">{p.description}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </FieldSet>

                {protection === 'email' && (
                  <Field>
                    <FieldLabel htmlFor="email">Recipient email</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="lucas@example.com"
                    />
                  </Field>
                )}

                {protection === 'code' && (
                  <Field>
                    <FieldLabel htmlFor="code">Access code</FieldLabel>
                    <Input
                      id="code"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      placeholder="Set a private code"
                    />
                    <FieldDescription>Share this with the recipient separately.</FieldDescription>
                  </Field>
                )}

                <Field>
                  <FieldLabel htmlFor="message">Message (optional)</FieldLabel>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Congratulations on winning first place!"
                    rows={3}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="expiration">Link expires in</FieldLabel>
                  <Select value={expiration} onValueChange={(v) => { if (v != null) setExpiration(v) }}>
                    <SelectTrigger id="expiration">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Unclaimed funds are automatically refunded to you after expiry.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardContent className="flex flex-col gap-4 py-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Review</h3>
              <ReviewRow label="Recipient" value={recipientName} />
              <ReviewRow label="Purpose" value={purpose} />
              {reference && <ReviewRow label="Reference" value={reference} />}
              <ReviewRow
                label="Protection"
                value={PROTECTION.find((p) => p.value === protection)?.label ?? ''}
              />
              {protection === 'email' && <ReviewRow label="Email" value={recipientEmail} />}
              <ReviewRow label="Expires in" value={`${expiration} days`} />
              <ReviewRow
                label="Payout methods"
                value={[allowStellar && 'Stellar', allowPix && 'PIX'].filter(Boolean).join(' · ')}
              />
              {message && <ReviewRow label="Message" value={message} />}
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between">
          {step > 1 ? (
            <Button variant="ghost" onClick={back}>
              <ArrowLeft data-icon="inline-start" />
              Back
            </Button>
          ) : (
            <ButtonLink variant="ghost" href="/dashboard">
              Cancel
            </ButtonLink>
          )}
          {step < 3 ? (
            <Button onClick={next}>
              Continue
              <ArrowRight data-icon="inline-end" />
            </Button>
          ) : (
            <Button onClick={handleFund}>
              <ShieldCheck data-icon="inline-start" />
              Fund and create link
            </Button>
          )}
        </div>
      </div>

      {/* Live summary */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <Card className="bg-navy text-navy-foreground">
          <CardContent className="flex flex-col gap-5 py-2">
            <div className="flex items-center gap-2 text-navy-foreground/70">
              <Sparkles className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Live quote</span>
            </div>
            <div>
              <p className="text-sm text-navy-foreground/70">You lock</p>
              {quoting ? (
                <Skeleton className="mt-1 h-9 w-40 bg-white/10" />
              ) : (
                <p className="text-3xl font-semibold tabular-nums">
                  {formatUSDC(fundingUsdc ?? 0)}
                </p>
              )}
              <p className="mt-1 text-sm text-navy-foreground/60">
                {numericAmount > 0
                  ? formatDisplay(numericAmount, currency)
                  : 'Enter an amount'}
              </p>
            </div>
            <div className="flex flex-col gap-2 border-t border-white/10 pt-4 text-sm">
              <QuoteRow
                label="Reference rate"
                value={
                  currency === 'BRL' && fundingUsdc
                    ? `1 USDC ≈ ${fundingRate.toFixed(4)} BRL`
                    : '1 USDC = 1 USD'
                }
              />
              <QuoteRow
                label="Cash-out fee"
                value="0.20% (paid at claim)"
              />
              <QuoteRow label="Network fee" value="Sponsored" />
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-brand" />
                <span className="text-xs text-navy-foreground/80">
                  Funds are locked on Stellar and fully refundable until claimed.
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Stepper({ step }: { step: number }) {
  const labels = ['Amount', 'Recipient', 'Review']
  return (
    <div className="flex items-center gap-2">
      {labels.map((label, i) => {
        const n = i + 1
        const active = step === n
        const done = step > n
        return (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex size-7 items-center justify-center rounded-full text-xs font-medium',
                  done && 'bg-success text-success-foreground',
                  active && 'bg-brand text-brand-foreground',
                  !done && !active && 'bg-secondary text-muted-foreground',
                )}
              >
                {done ? <CheckCircle2 className="size-4" /> : n}
              </span>
              <span
                className={cn(
                  'hidden text-sm font-medium sm:inline',
                  active || done ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
            </div>
            {i < labels.length - 1 && <div className="h-px flex-1 bg-border" />}
          </div>
        )
      })}
    </div>
  )
}

function MethodToggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
      <div className="flex flex-col">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-3 text-sm last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

function QuoteRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-navy-foreground/60">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}
