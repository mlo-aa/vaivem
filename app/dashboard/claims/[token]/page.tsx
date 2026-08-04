import { notFound } from 'next/navigation'
import { DashboardTopbar } from '@/components/dashboard/dashboard-topbar'
import { ClaimDetail } from '@/components/dashboard/claim-detail'
import { claims } from '@/lib/mock-data'

export default async function ClaimDetailPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const claim = claims.find((c) => c.token.toLowerCase() === token.toLowerCase())
  if (!claim) notFound()

  return (
    <>
      <DashboardTopbar title="Claim details" />
      <main className="flex-1 p-4 sm:p-6">
        <ClaimDetail claim={claim} />
      </main>
    </>
  )
}
