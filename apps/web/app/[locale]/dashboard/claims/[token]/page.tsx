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
      <main className="flex-1 px-4 pb-10 sm:px-8">
        <ClaimDetailLoader token={token} />
      </main>
    </>
  )
}
