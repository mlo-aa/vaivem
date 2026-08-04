'use client'

import { useState } from 'react'
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

export function SharePanel({ token, amountLabel }: { token: string; amountLabel: string }) {
  const [copied, setCopied] = useState(false)
  const url = `https://claimlink.app/br/${token}`

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
