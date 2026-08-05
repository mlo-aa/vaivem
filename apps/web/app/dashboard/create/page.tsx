import { DashboardTopbar } from '@/components/dashboard/dashboard-topbar'
import { CreateWizard } from '@/components/dashboard/create-wizard'

export default function CreateClaimPage() {
  return (
    <>
      <DashboardTopbar title="New claim" />
      <main className="flex-1 p-4 sm:p-6">
        <CreateWizard />
      </main>
    </>
  )
}
