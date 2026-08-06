'use client'

import { FormEvent, Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'

const RESEND_COOLDOWN_SECONDS = 60

function LoginInner() {
  const t = useTranslations('login')
  const te = useTranslations('errors')
  const router = useRouter()
  const search = useSearchParams()
  const next = search.get('next') || '/dashboard'
  const callbackUrl = next.startsWith('/') ? next : '/dashboard'

  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [devCode, setDevCode] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  function translateError(code: unknown) {
    if (typeof code === 'string' && te.has(code)) return te(code)
    return te('unknown')
  }

  async function requestCode(targetEmail: string) {
    setPending(true)
    setError(null)
    setDevCode(null)
    try {
      const res = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(translateError(data.error))
        return false
      }
      if (data.devMode && data.code) {
        setDevCode(String(data.code))
      }
      setCooldown(RESEND_COOLDOWN_SECONDS)
      return true
    } catch {
      setError(te('network'))
      return false
    } finally {
      setPending(false)
    }
  }

  async function onEmailSubmit(e: FormEvent) {
    e.preventDefault()
    const ok = await requestCode(email)
    if (ok) setStep('code')
  }

  async function onResend() {
    if (cooldown > 0 || pending) return
    await requestCode(email)
  }

  async function verify(nextCode: string) {
    if (nextCode.length !== 6 || pending) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: nextCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(translateError(data.error))
        setCode('')
        return
      }
      router.replace(callbackUrl)
      router.refresh()
    } catch {
      setError(te('network'))
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          {step === 'email' ? t('title') : t('enterCode')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {step === 'email' ? t('subtitle') : t('codeSent', { email })}
        </p>
      </CardHeader>
      <CardContent>
        {step === 'email' ? (
          <form onSubmit={onEmailSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                {t('emailLabel')}
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={t('emailPlaceholder')}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={pending}>
              {pending ? t('sending') : t('sendCode')}
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="login-otp" className="text-sm font-medium">
                {t('enterCode')}
              </label>
              <InputOTP
                id="login-otp"
                maxLength={6}
                value={code}
                onChange={(value) => {
                  const digits = value.replace(/\D/g, '').slice(0, 6)
                  setCode(digits)
                  if (digits.length === 6) void verify(digits)
                }}
                disabled={pending}
                containerClassName="justify-center"
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="size-9 sm:size-10" />
                  <InputOTPSlot index={1} className="size-9 sm:size-10" />
                  <InputOTPSlot index={2} className="size-9 sm:size-10" />
                  <InputOTPSlot index={3} className="size-9 sm:size-10" />
                  <InputOTPSlot index={4} className="size-9 sm:size-10" />
                  <InputOTPSlot index={5} className="size-9 sm:size-10" />
                </InputOTPGroup>
              </InputOTP>
            </div>

            {devCode ? (
              <p className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm">
                Dev mode — code:{' '}
                <button
                  type="button"
                  className="font-mono font-semibold underline-offset-2 hover:underline"
                  onClick={() => {
                    setCode(devCode)
                    void verify(devCode)
                  }}
                >
                  {devCode}
                </button>
              </p>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button
              type="button"
              disabled={pending || code.length !== 6}
              onClick={() => void verify(code)}
            >
              {pending ? t('verifying') : t('verify')}
            </Button>

            <div className="flex items-center justify-between gap-2 text-sm">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setStep('email')
                  setCode('')
                  setError(null)
                  setDevCode(null)
                }}
              >
                {t('changeEmail')}
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                disabled={cooldown > 0 || pending}
                onClick={() => void onResend()}
              >
                {cooldown > 0 ? `${t('resend')} (${cooldown}s)` : t('resend')}
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <div className="dark relative flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(34,197,94,0.12),_transparent_55%)]" />
      <Logo />
      <Suspense fallback={<Card className="h-48 w-full max-w-sm animate-pulse" />}>
        <LoginInner />
      </Suspense>
    </div>
  )
}
