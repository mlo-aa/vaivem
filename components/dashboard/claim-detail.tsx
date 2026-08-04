'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Ban,
  CalendarClock,
  ExternalLink,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { StatusBadge } from '@/components/status-badge'
import { SharePanel } from '@/components/share-panel'
import { ClaimTimeline } from '@/components/dashboard/claim-timeline'
import {
  cancelClaim,
  extendExpiration,
  refundClaim,
} from '@/lib/services'
import {
  formatDateTime,
  formatDisplay,
  formatUSDC,
  isActiveStatus,
  maskEmail,
  maskStellarAddress,
  timeUntil,
} from '@/lib/format'
import type { Claim } from '@/lib/types'
import { toast } from 'sonner'

export function ClaimDetail({ claim: initialClaim }: { claim: Claim }) {
  const router = useRouter()
  const [claim, setClaim] = useState(initialClaim)
  const [pending, setPending] = useState<'cancel' | 'refund' | 'extend' | null>(null)

  const active = isActiveStatus(claim.status)
  const canRefund = active && claim.status !== 'claimed' && claim.status !== 'cashing_out'
  const expiry = timeUntil(claim.expiresAt)

  async function handleCancel() {
    setPending('cancel')
    const updated = await cancelClaim(claim)
    setClaim(updated)
    setPending(null)
    toast.success('Claim cancelled and funds returned')
  }

  async function handleRefund() {
    setPending('refund')
    const updated = await refundClaim(claim)
    setClaim(updated)
    setPending(null)
    toast.success('Funds refunded to your balance')
  }

  async function handleExtend() {
    setPending('extend')
    const updated = await extendExpiration(claim, 7)
    setClaim(updated)
    setPending(null)
    toast.success('Expiration extended by 7 days')
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Link
        href="/dashboard"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All claims
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {formatDisplay(claim.displayAmount, claim.displayCurrency)}
            </h1>
            <StatusBadge status={claim.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {formatUSDC(claim.amount)} · {claim.purpose}
            {claim.reference ? ` · ${claim.reference}` : ''}
          </p>
        </div>

        {active && (
          <div className="flex flex-wrap gap-2">
            {claim.status !== 'claimed' && claim.status !== 'cashing_out' && (
              <Button variant="outline" size="sm" onClick={handleExtend} disabled={pending !== null}>
                {pending === 'extend' ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <CalendarClock data-icon="inline-start" />
                )}
                Extend 7 days
              </Button>
            )}
            {canRefund && (
              <ConfirmAction
                trigger={
                  <Button variant="outline" size="sm" disabled={pending !== null}>
                    {pending === 'refund' ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <RotateCcw data-icon="inline-start" />
                    )}
                    Refund
                  </Button>
                }
                title="Refund this payout?"
                description="The locked USDC will be returned to your organization balance. The claim link will stop working immediately."
                confirmLabel="Refund funds"
                onConfirm={handleRefund}
              />
            )}
            <ConfirmAction
              trigger={
                <Button variant="destructive" size="sm" disabled={pending !== null}>
                  {pending === 'cancel' ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Ban data-icon="inline-start" />
                  )}
                  Cancel
                </Button>
              }
              title="Cancel this claim?"
              description="This permanently voids the link and returns funds to your balance. This cannot be undone."
              confirmLabel="Cancel claim"
              onConfirm={handleCancel}
            />
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Detail label="Recipient" value={claim.recipientName} />
              <Detail
                label="Contact"
                value={claim.recipientEmail ? maskEmail(claim.recipientEmail) : 'Public link'}
              />
              <Detail
                label="Protection"
                value={
                  claim.protectionType === 'email'
                    ? 'Email verification'
                    : claim.protectionType === 'code'
                      ? 'Access code'
                      : 'Public link'
                }
              />
              <Detail
                label="Payout method"
                value={
                  claim.payoutMethod === 'pix'
                    ? 'PIX (BRL)'
                    : claim.payoutMethod === 'stellar'
                      ? 'Stellar wallet'
                      : 'Not yet chosen'
                }
              />
              <Detail label="Created" value={formatDateTime(claim.createdAt)} />
              <Detail
                label={expiry.expired ? 'Expired' : 'Expires'}
                value={expiry.expired ? formatDateTime(claim.expiresAt) : expiry.label}
              />
              {claim.stellarTransactionHash && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground">Stellar transaction</p>
                  <a
                    href="https://stellar.expert"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1.5 font-mono text-sm text-info hover:underline"
                  >
                    {maskStellarAddress(claim.stellarTransactionHash)}
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              )}
              {claim.message && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground">Message to recipient</p>
                  <p className="mt-1 rounded-lg bg-secondary p-3 text-sm">{claim.message}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ClaimTimeline claim={claim} />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {active ? (
            <Card>
              <CardHeader>
                <CardTitle>Share</CardTitle>
              </CardHeader>
              <CardContent>
                <SharePanel
                  token={claim.token}
                  amountLabel={formatDisplay(claim.displayAmount, claim.displayCurrency)}
                />
                <Separator className="my-4" />
                <Button
                  variant="outline"
                  className="w-full"
                  render={<Link href={`/claim/${claim.token}`} target="_blank" />}
                  nativeButton={false}
                >
                  Preview recipient view
                  <ExternalLink data-icon="inline-end" />
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  This claim is {claim.status}. No further action is required.
                </p>
                <Button variant="outline" onClick={() => router.push('/dashboard/create')}>
                  Create a new claim
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}

function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  trigger: React.ReactNode
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
