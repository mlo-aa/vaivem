'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
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
  const t = useTranslations('dashboard.detail')
  const tStatus = useTranslations('status')
  const tTime = useTranslations('time')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const [claim, setClaim] = useState(initialClaim)
  const [pending, setPending] = useState<'cancel' | 'refund' | 'extend' | null>(null)

  const active = isActiveStatus(claim.status)
  const canRefund = active && claim.status !== 'claimed' && claim.status !== 'cashing_out'
  const expiry = timeUntil(claim.expiresAt, tTime)

  async function handleCancel() {
    setPending('cancel')
    try {
      const updated = await cancelClaim(claim)
      setClaim(updated)
      toast.success(t('toastCancelled'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toastCancelFailed'))
    } finally {
      setPending(null)
    }
  }

  async function handleRefund() {
    setPending('refund')
    try {
      const updated = await refundClaim(claim)
      setClaim(updated)
      toast.success(t('toastRefunded'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toastRefundFailed'))
    } finally {
      setPending(null)
    }
  }

  async function handleExtend() {
    setPending('extend')
    try {
      const updated = await extendExpiration(claim, 7)
      setClaim(updated)
      toast.success(t('toastExtended'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toastExtendFailed'))
    } finally {
      setPending(null)
    }
  }

  function protectionLabel() {
    if (claim.protectionType === 'email') return t('protectionEmail')
    if (claim.protectionType === 'code') return t('protectionCode')
    return t('protectionPublic')
  }

  function payoutLabel() {
    if (claim.payoutMethod === 'pix') return t('payoutPix')
    if (claim.payoutMethod === 'spei') return t('payoutSpei')
    if (claim.payoutMethod === 'stellar') return t('payoutStellar')
    return t('payoutNotChosen')
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Link
        href="/dashboard"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t('allClaims')}
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-[-0.02em] tabular-nums sm:text-[2.5rem]">
              {formatDisplay(claim.displayAmount, claim.displayCurrency, locale)}
            </h1>
            <StatusBadge status={claim.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {formatUSDC(claim.amount, locale)} · {claim.purpose}
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
                {t('extend7Days')}
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
                    {t('refund')}
                  </Button>
                }
                title={t('refundTitle')}
                description={t('refundDescription')}
                confirmLabel={t('refundConfirm')}
                keepLabel={t('keepIt')}
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
                  {tCommon('cancel')}
                </Button>
              }
              title={t('cancelTitle')}
              description={t('cancelDescription')}
              confirmLabel={t('cancelConfirm')}
              keepLabel={t('keepIt')}
              onConfirm={handleCancel}
            />
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('details')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Detail label={t('recipient')} value={claim.recipientName} />
              <Detail
                label={t('contact')}
                value={claim.recipientEmail ? maskEmail(claim.recipientEmail) : t('publicLink')}
              />
              <Detail label={t('protection')} value={protectionLabel()} />
              <Detail label={t('payoutMethod')} value={payoutLabel()} />
              <Detail label={t('created')} value={formatDateTime(claim.createdAt, locale)} />
              <Detail
                label={expiry.expired ? t('expired') : t('expires')}
                value={expiry.expired ? formatDateTime(claim.expiresAt, locale) : expiry.label}
              />
              {claim.stellarTransactionHash && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground">{t('stellarTx')}</p>
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${claim.stellarTransactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1.5 font-mono text-sm text-info hover:underline"
                  >
                    {maskStellarAddress(claim.stellarTransactionHash)}
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              )}
              {claim.withdrawalReference && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground">{t('pixOrder')}</p>
                  <p className="mt-1 font-mono text-sm">{claim.withdrawalReference}</p>
                </div>
              )}
              {claim.message && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground">{t('messageToRecipient')}</p>
                  <p className="mt-1 rounded-[1.25rem] bg-surface p-3 text-sm dark:border dark:border-border">{claim.message}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('timeline')}</CardTitle>
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
                <CardTitle>{t('share')}</CardTitle>
              </CardHeader>
              <CardContent>
                <SharePanel
                  token={claim.token}
                  amountLabel={formatDisplay(claim.displayAmount, claim.displayCurrency, locale)}
                />
                <Separator className="my-4" />
                <Button
                  variant="outline"
                  className="w-full"
                  render={<Link href={`/claim/${claim.token}`} target="_blank" />}
                  nativeButton={false}
                >
                  {t('previewRecipient')}
                  <ExternalLink data-icon="inline-end" />
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{t('status')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  {t('statusBody', { status: tStatus(claim.status) })}
                </p>
                <Button variant="outline" onClick={() => router.push('/dashboard/create')}>
                  {t('createNew')}
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
  keepLabel,
  onConfirm,
}: {
  trigger: React.ReactElement
  title: string
  description: string
  confirmLabel: string
  keepLabel: string
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
          <AlertDialogCancel>{keepLabel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
