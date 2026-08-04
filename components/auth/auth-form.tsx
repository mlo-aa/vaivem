'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, Fingerprint, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { authAdapter } from '@/lib/adapters'
import { toast } from 'sonner'

type Mode = 'login' | 'signup'
type Method = null | 'google' | 'passkey'

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState<Method | 'email' | 'verify' | null>(null)
  const [stage, setStage] = useState<'form' | 'verify'>('form')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isSignup = mode === 'signup'

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.')
      return
    }
    if (isSignup && name.trim().length < 2) {
      setError('Please enter your name.')
      return
    }
    setLoading('email')
    await authAdapter.signInWithEmail(email)
    setLoading(null)
    setStage('verify')
    toast.success('We sent you a 6-digit code', {
      description: 'Demo tip: any 6 digits work (except 000000).',
    })
  }

  async function handleVerify() {
    setError(null)
    setLoading('verify')
    const res = await authAdapter.verifyOtp(otp)
    setLoading(null)
    if (!res.ok) {
      setError('That code is incorrect or expired. Try again.')
      return
    }
    toast.success('Verified — welcome to ClaimLink')
    router.push('/dashboard')
  }

  async function handleProvider(method: 'google' | 'passkey') {
    setError(null)
    setLoading(method)
    if (method === 'google') await authAdapter.signInWithGoogle()
    else await authAdapter.signInWithPasskey()
    setLoading(null)
    router.push('/dashboard')
  }

  if (stage === 'verify') {
    return (
      <div className="flex flex-col gap-6">
        <button
          onClick={() => {
            setStage('form')
            setOtp('')
            setError(null)
          }}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>.
          </p>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Verification failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col items-center gap-4">
          <InputOTP maxLength={6} value={otp} onChange={setOtp} aria-label="Verification code">
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button onClick={handleVerify} disabled={otp.length !== 6 || loading === 'verify'}>
          {loading === 'verify' && <Spinner data-icon="inline-start" />}
          Verify and continue
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Didn&apos;t get it?{' '}
          <button className="font-medium text-foreground hover:underline" onClick={handleEmail}>
            Resend code
          </button>
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isSignup ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isSignup
            ? 'Start sending walletless USDC payouts in minutes.'
            : 'Log in to manage your ClaimLinks and payouts.'}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2.5">
        <Button
          variant="outline"
          size="lg"
          onClick={() => handleProvider('google')}
          disabled={loading !== null}
        >
          {loading === 'google' ? <Spinner data-icon="inline-start" /> : <GoogleIcon />}
          Continue with Google
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => handleProvider('passkey')}
          disabled={loading !== null}
        >
          {loading === 'passkey' ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Fingerprint data-icon="inline-start" />
          )}
          Continue with passkey
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleEmail} className="flex flex-col gap-4">
        {isSignup && (
          <Field>
            <FieldLabel htmlFor="name">Full name</FieldLabel>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Marina Alves"
              autoComplete="name"
            />
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
          />
        </Field>
        <Button type="submit" size="lg" disabled={loading !== null}>
          {loading === 'email' ? <Spinner data-icon="inline-start" /> : <Mail data-icon="inline-start" />}
          Continue with email
        </Button>
      </form>

      <FieldDescription className="text-center">
        By continuing you agree to our{' '}
        <Link href="/" className="text-foreground hover:underline">
          Terms
        </Link>{' '}
        and{' '}
        <Link href="/" className="text-foreground hover:underline">
          Privacy Policy
        </Link>
        .
      </FieldDescription>

      <p className="text-center text-sm text-muted-foreground">
        {isSignup ? 'Already have an account?' : 'New to ClaimLink?'}{' '}
        <Link
          href={isSignup ? '/login' : '/signup'}
          className="font-medium text-foreground hover:underline"
        >
          {isSignup ? 'Log in' : 'Create an account'}
        </Link>
      </p>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" data-icon="inline-start" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  )
}
