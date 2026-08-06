'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { DashboardTopbar } from '@/components/dashboard/dashboard-topbar'
import { CreateWizard } from '@/components/dashboard/create-wizard'
import { Skeleton } from '@/components/ui/skeleton'
import { useSenderBalance } from '@/lib/use-sender-balance'

export default function CreateClaimPage() {
  const t = useTranslations('create')
  const router = useRouter()
  const { balance, loading, funded } = useSenderBalance()

  useEffect(() => {
    if (loading) return
    if (!funded) router.replace('/dashboard/funding')
  }, [loading, funded, router])

  if (loading || balance === 0) {
    return (
      <>
        <DashboardTopbar title={t('title')} />
        <main className="flex-1 px-4 pb-10 sm:px-8">
          <Skeleton className="mx-auto h-64 max-w-lg w-full" />
        </main>
      </>
    )
  }

  return (
    <>
      <DashboardTopbar title={t('title')} />
      <main className="flex-1 px-4 pb-10 sm:px-8">
        <div className="mx-auto mb-4 max-w-lg text-sm text-muted-foreground">
          {t('batchHint')}{' '}
          <Link
            href="/dashboard/create/batch"
            className="text-foreground underline underline-offset-2"
          >
            {t('batchLink')}
          </Link>
        </div>
        <CreateWizard />
      </main>
    </>
  )
}
