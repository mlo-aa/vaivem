'use client'

import { useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Check, Copy, Mail, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { toast } from 'sonner'

/**
 * Builds the absolute claim URL recipients open.
 *
 * Wrong previously: hardcoded `https://vaivem.app/br/{token}` — that path never
 * existed in this app (`/claim/{token}` is the real route), so shared links and
 * QR codes pointed at a dead URL even when the token in the store was valid.
 */
export function claimShareUrl(token: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  const fromWindow =
    typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : ''
  const base = fromEnv || fromWindow
  return `${base}/claim/${encodeURIComponent(token)}`
}

export function SharePanel({ token, amountLabel }: { token: string; amountLabel: string }) {
  const [copied, setCopied] = useState(false)
  // Recompute on the client so we pick up window.location.origin when env is unset.
  const url = useMemo(() => claimShareUrl(token), [token])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      /* clipboard may be blocked in the preview iframe */
    }
    setCopied(true)
    toast.success('Claim link copied')
    setTimeout(() => setCopied(false), 2000)
  }

  const waText = encodeURIComponent(`You've received ${amountLabel}. Claim it here: ${url}`)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6">
        <div className="rounded-xl bg-background p-3 ring-1 ring-border">
          <QRCodeSVG value={url} size={148} bgColor="transparent" fgColor="currentColor" />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Scan to open the claim on any phone
        </p>
      </div>

      <InputGroup>
        <InputGroupInput readOnly value={url} className="font-mono text-sm" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton onClick={copy} aria-label="Copy link">
            {copied ? <Check /> : <Copy />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          render={
            <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer" />
          }
          nativeButton={false}
        >
          <MessageCircle data-icon="inline-start" />
          WhatsApp
        </Button>
        <Button
          variant="outline"
          render={
            <a
              href={`mailto:?subject=You have a payout&body=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
          nativeButton={false}
        >
          <Mail data-icon="inline-start" />
          Email
        </Button>
      </div>
    </div>
  )
}
