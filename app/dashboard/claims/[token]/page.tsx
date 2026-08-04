import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar"
import { ClaimDetailLoader } from "@/components/dashboard/claim-detail-loader"

export default async function ClaimDetailPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  return (
    <>
      <DashboardTopbar title="Claim details" />
      <main className="flex-1 p-4 sm:p-6">
        <ClaimDetailLoader token={token} />
      </main>
    </>
  )
}
