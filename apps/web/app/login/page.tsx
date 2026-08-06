'use client'

import { FormEvent, Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

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
        setError(data.message ?? data.error ?? 'Could not send code')
        return false
      }
      if (data.devMode && data.code) {
        setDevCode(String(data.code))
      }
      setCooldown(RESEND_COOLDOWN_SECONDS)
      return true
    } catch {
      setError('Could not reach the login service.')
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
        setError(data.message ?? data.error ?? 'Invalid code')
        setCode('')
        return
      }
      router.replace(callbackUrl)
      router.refresh()
    } catch {
      setError('Could not reach the login service.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          {step === 'email' ? 'Sign in' : 'Enter your code'}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {step === 'email'
            ? 'Sender console — we’ll email you a 6-digit code. Recipients never need an account.'
            : `We sent a code to ${email}.`}
        </p>
      </CardHeader>
      <CardContent>
        {step === 'email' ? (
          <form onSubmit={onEmailSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={pending}>
              {pending ? 'Sending…' : 'Continue'}
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="login-otp" className="text-sm font-medium">
                6-digit code
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
              {pending ? 'Verifying…' : 'Sign in'}
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
                Change email
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                disabled={cooldown > 0 || pending}
                onClick={() => void onResend()}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
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
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4">
      <Logo />
      <Suspense fallback={<Card className="h-48 w-full max-w-sm animate-pulse" />}>
        <LoginInner />
      </Suspense>
    </div>
  )
}
