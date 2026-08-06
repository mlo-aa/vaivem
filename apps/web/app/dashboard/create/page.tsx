'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardTopbar } from '@/components/dashboard/dashboard-topbar'
import { CreateWizard } from '@/components/dashboard/create-wizard'
import { Skeleton } from '@/components/ui/skeleton'
import { useSenderBalance } from '@/lib/use-sender-balance'

export default function CreateClaimPage() {
  const router = useRouter()
  const { balance, loading, funded } = useSenderBalance()

  useEffect(() => {
    if (loading) return
    if (!funded) router.replace('/dashboard/funding')
  }, [loading, funded, router])

  if (loading || balance === 0) {
    return (
      <>
        <DashboardTopbar title="New claim" />
        <main className="flex-1 p-4 sm:p-6">
          <Skeleton className="mx-auto h-64 max-w-lg w-full" />
        </main>
      </>
    )
  }

  return (
    <>
      <DashboardTopbar title="New claim" />
      <main className="flex-1 p-4 sm:p-6">
        <CreateWizard />
      </main>
    </>
  )
}
