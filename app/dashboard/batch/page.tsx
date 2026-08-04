import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar"
import { BatchPayouts } from "@/components/dashboard/batch-payouts"

export default function BatchPage() {
  return (
    <>
      <DashboardTopbar title="Batch payouts" />
      <main className="flex-1 p-4 sm:p-6">
        <div className="mx-auto w-full max-w-5xl">
          <p className="mb-6 max-w-xl text-sm text-muted-foreground">
            Pay hundreds of people at once. Import a list, review, and fund every ClaimLink in one go.
          </p>
          <BatchPayouts />
        </div>
      </main>
    </>
  )
}
