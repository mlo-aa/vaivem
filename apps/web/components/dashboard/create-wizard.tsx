'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
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
import { SharePanel } from '@/components/share-panel'
import { ProcessSteps } from '@/components/process-steps'
import { cn } from '@/lib/utils'
import {
  createClaim,
  getFundingUsdc,
  type CreateClaimInput,
} from '@/lib/services'
import { formatDisplay, formatUSDC, USD_TO_BRL } from '@/lib/format'
import { MIN_AMOUNT_USDC } from '@/lib/limits'
import type { Claim, DisplayCurrency, ProtectionType } from '@/lib/types'

const PURPOSE_OPTIONS = [
  { id: 'hackathonPrize', value: 'Hackathon prize' },
  { id: 'freelancerPayment', value: 'Freelancer payment' },
  { id: 'communityReward', value: 'Community reward' },
  { id: 'refund', value: 'Refund' },
  { id: 'grant', value: 'Grant' },
  { id: 'eventIncentive', value: 'Event incentive' },
  { id: 'other', value: 'Other' },
] as const

const PROTECTION_OPTIONS: { value: ProtectionType; icon: typeof Globe }[] = [
  { value: 'email', icon: Mail },
  { value: 'code', icon: Lock },
  { value: 'public', icon: Globe },
]

const FUND_STEP_KEYS = ['reserving', 'creating', 'sponsoring', 'publishing'] as const

type Stage = 'form' | 'funding' | 'done'

export function CreateWizard() {
  const t = useTranslations('create')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [stage, setStage] = useState<Stage>('form')

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

  // Checked synchronously so nothing is sent for an amount the provider rejects.
  // Only PIX goes through Etherfuse, so a Stellar-only claim can be any amount.
  const rate = currency === 'BRL' ? USD_TO_BRL : 1
  const usdcForAmount = numericAmount / rate
  const belowMinimum = allowPix && numericAmount > 0 && usdcForAmount < MIN_AMOUNT_USDC
  // Rounded up so converting the shown value back never lands below the minimum.
  const minDisplayAmount = Math.ceil(MIN_AMOUNT_USDC * rate * 100) / 100
  const minimumMessage = t('minimumMessage', {
    usdc: formatUSDC(MIN_AMOUNT_USDC, locale),
    display: formatDisplay(minDisplayAmount, currency, locale),
  })

  function purposeLabel(value: string) {
    const opt = PURPOSE_OPTIONS.find((p) => p.value === value)
    return opt ? t(`purposes.${opt.id}`) : value
  }

  function protectionLabel(value: ProtectionType) {
    return t(`protection.${value}.label`)
  }

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
    if (numericAmount <= 0) return t('errors.amountZero')
    if (belowMinimum) return minimumMessage
    if (numericAmount > 100000) return t('errors.amountMax')
    if (!allowStellar && !allowPix) return t('errors.needMethod')
    return null
  }

  function validateStep2() {
    if (recipientName.trim().length < 2) return t('errors.recipientName')
    if (protection === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail))
      return t('errors.recipientEmail')
    if (protection === 'code' && accessCode.trim().length < 4)
      return t('errors.accessCodeShort')
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
    if (belowMinimum) {
      setError(minimumMessage)
      setStep(1)
      return
    }
    setStage('funding')
    setFundStep(0)
    const input: CreateClaimInput = {
      amount: numericAmount,
      displayCurrency: currency,
      fundingUsdc: fundingUsdc ?? undefined,
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
    try {
      if (fundingUsdc == null || fundingUsdc <= 0) {
        throw new Error(t('errors.quoteNotReady'))
      }
      // createClaim funds the exact USDC shown (fundingUsdc) and persists server-side.
      const shared = await createClaim(input, (s) => setFundStep(s))
      setClaim(shared)
      setStage('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.createFailed'))
      setStage('form')
    }
  }

  if (stage === 'funding') {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col gap-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold">{t('fundingTitle')}</h2>
              <p className="text-sm text-muted-foreground">
                {t('fundingSubtitle', {
                  amount: formatUSDC(fundingUsdc ?? 0, locale),
                  name: recipientName,
                })}
              </p>
            </div>
          </div>
          <ProcessSteps
            steps={FUND_STEP_KEYS.map((key) => t(`fundSteps.${key}`))}
            current={fundStep}
          />
        </CardContent>
      </Card>
    )
  }

  if (stage === 'done' && claim) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <CheckCircle2 className="size-7" />
          </span>
          <div>
            <h2 className="text-xl font-semibold">{t('doneTitle')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('doneSubtitle', {
                amount: formatDisplay(claim.displayAmount, claim.displayCurrency, locale),
              })}
            </p>
          </div>
        </div>
        <SharePanel
          token={claim.token}
          amountLabel={formatDisplay(claim.displayAmount, claim.displayCurrency, locale)}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <ButtonLink href={`/dashboard/claims/${claim.token}`} className="flex-1">
            {t('viewDetails')}
          </ButtonLink>
          <Button variant="outline" className="flex-1" onClick={() => router.push('/dashboard')}>
            {t('backToDashboard')}
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
          <div className="rounded-[1.25rem] bg-destructive/10 px-4 py-3 text-sm text-destructive dark:border dark:border-destructive/40">
            {error}
          </div>
        )}

        {step === 1 && (
          <Card>
            <CardContent className="py-2">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="amount">{t('amountLabel')}</FieldLabel>
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
                  {belowMinimum && (
                    <p className="text-sm text-destructive">{minimumMessage}</p>
                  )}
                  <FieldDescription>{t('amountHint')}</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="purpose">{t('purposeLabel')}</FieldLabel>
                  <Select value={purpose} onValueChange={(v) => { if (v != null) setPurpose(v) }}>
                    <SelectTrigger id="purpose">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PURPOSE_OPTIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {t(`purposes.${p.id}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="reference">{t('referenceLabel')}</FieldLabel>
                  <Input
                    id="reference"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder={t('referencePlaceholder')}
                  />
                </Field>

                <FieldSet>
                  <FieldLegend>{t('methodsLegend')}</FieldLegend>
                  <FieldGroup className="gap-3">
                    <MethodToggle
                      title={t('methodStellarTitle')}
                      description={t('methodStellarDesc')}
                      checked={allowStellar}
                      onChange={setAllowStellar}
                    />
                    <MethodToggle
                      title={t('methodPixTitle')}
                      description={t('methodPixDesc')}
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
                  <FieldLabel htmlFor="recipient">{t('recipientLabel')}</FieldLabel>
                  <Input
                    id="recipient"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder={t('recipientPlaceholder')}
                  />
                </Field>

                <FieldSet>
                  <FieldLegend>{t('protectionLegend')}</FieldLegend>
                  <FieldDescription>{t('protectionHint')}</FieldDescription>
                  <div className="mt-2 grid gap-2">
                    {PROTECTION_OPTIONS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setProtection(p.value)}
                        className={cn(
                          'flex items-start gap-3 rounded-[1.25rem] bg-surface p-3 text-left transition-colors duration-150 dark:border dark:border-border',
                          protection === p.value
                            ? 'bg-primary text-primary-foreground dark:border-transparent'
                            : 'hover:opacity-90',
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 flex size-8 items-center justify-center rounded-full',
                            protection === p.value
                              ? 'bg-primary-foreground/15 text-primary-foreground'
                              : 'bg-background text-muted-foreground',
                          )}
                        >
                          <p.icon className="size-4" />
                        </span>
                        <span className="flex flex-col">
                          <span className="text-sm font-medium">
                            {t(`protection.${p.value}.label`)}
                          </span>
                          <span
                            className={cn(
                              'text-xs',
                              protection === p.value
                                ? 'text-primary-foreground/80'
                                : 'text-muted-foreground',
                            )}
                          >
                            {t(`protection.${p.value}.description`)}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </FieldSet>

                {protection === 'email' && (
                  <Field>
                    <FieldLabel htmlFor="email">{t('emailLabel')}</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder={t('emailPlaceholder')}
                    />
                  </Field>
                )}

                {protection === 'code' && (
                  <Field>
                    <FieldLabel htmlFor="code">{t('accessCodeLabel')}</FieldLabel>
                    <Input
                      id="code"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      placeholder={t('accessCodePlaceholder')}
                    />
                    <FieldDescription>{t('accessCodeHint')}</FieldDescription>
                  </Field>
                )}

                <Field>
                  <FieldLabel htmlFor="message">{t('messageLabel')}</FieldLabel>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t('messagePlaceholder')}
                    rows={3}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="expiration">{t('expirationLabel')}</FieldLabel>
                  <Select value={expiration} onValueChange={(v) => { if (v != null) setExpiration(v) }}>
                    <SelectTrigger id="expiration">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['3', '7', '14', '30'].map((n) => (
                        <SelectItem key={n} value={n}>
                          {t('expirationDays', { n: Number(n) })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>{t('expirationHint')}</FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardContent className="flex flex-col gap-4 py-2">
              <h3 className="text-sm font-semibold text-muted-foreground">{t('reviewTitle')}</h3>
              <ReviewRow label={t('reviewRecipient')} value={recipientName} />
              <ReviewRow label={t('reviewPurpose')} value={purposeLabel(purpose)} />
              {reference && <ReviewRow label={t('reviewReference')} value={reference} />}
              <ReviewRow label={t('reviewProtection')} value={protectionLabel(protection)} />
              {protection === 'email' && (
                <ReviewRow label={t('reviewEmail')} value={recipientEmail} />
              )}
              <ReviewRow
                label={t('reviewExpires')}
                value={t('reviewExpiresValue', { n: Number(expiration) })}
              />
              <ReviewRow
                label={t('reviewMethods')}
                value={[
                  allowStellar && t('reviewMethodStellar'),
                  allowPix && t('reviewMethodPix'),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
              {message && <ReviewRow label={t('reviewMessage')} value={message} />}
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between">
          {step > 1 ? (
            <Button variant="ghost" onClick={back}>
              <ArrowLeft data-icon="inline-start" />
              {tCommon('back')}
            </Button>
          ) : (
            <ButtonLink variant="ghost" href="/dashboard">
              {tCommon('cancel')}
            </ButtonLink>
          )}
          {step < 3 ? (
            <Button onClick={next} disabled={step === 1 && belowMinimum}>
              {tCommon('continue')}
              <ArrowRight data-icon="inline-end" />
            </Button>
          ) : (
            <Button onClick={handleFund}>
              <ShieldCheck data-icon="inline-start" />
              {t('fundAndCreate')}
            </Button>
          )}
        </div>
      </div>

      {/* Live summary */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <Card className="bg-primary text-primary-foreground dark:border-transparent">
          <CardContent className="flex flex-col gap-5 py-2">
            <div className="flex items-center gap-2 text-primary-foreground/70">
              <Sparkles className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wide">{t('liveQuote')}</span>
            </div>
            <div>
              <p className="text-sm text-primary-foreground/70">{t('youLock')}</p>
              {quoting ? (
                <Skeleton className="mt-1 h-9 w-40 bg-primary-foreground/15" />
              ) : (
                <p className="text-3xl font-semibold tabular-nums tracking-[-0.02em] sm:text-4xl">
                  {formatUSDC(fundingUsdc ?? 0, locale)}
                </p>
              )}
              <p className="mt-1 text-sm text-primary-foreground/60">
                {numericAmount > 0
                  ? formatDisplay(numericAmount, currency, locale)
                  : t('enterAmount')}
              </p>
            </div>
            <div className="flex flex-col gap-2 border-t border-primary-foreground/15 pt-4 text-sm">
              <QuoteRow
                label={t('referenceRate')}
                value={
                  currency === 'BRL' && fundingUsdc
                    ? t('rateBrl', { rate: fundingRate.toFixed(4) })
                    : t('rateUsd')
                }
              />
              <QuoteRow label={t('cashOutFee')} value={t('cashOutFeeValue')} />
              <QuoteRow label={t('networkFee')} value={t('networkFeeValue')} />
            </div>
            <div className="rounded-[1rem] bg-primary-foreground/10 p-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4" />
                <span className="text-xs text-primary-foreground/80">{t('lockedHint')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Stepper({ step }: { step: number }) {
  const t = useTranslations('create')
  const labels = [t('steps.amount'), t('steps.recipient'), t('steps.review')]
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
                  done && 'bg-foreground text-background',
                  active && 'bg-primary text-primary-foreground',
                  !done && !active && 'bg-surface text-muted-foreground',
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
    <div className="flex items-center justify-between gap-4 rounded-[1.25rem] bg-surface p-3 dark:border dark:border-border">
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
      <span className="text-primary-foreground/60">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}
