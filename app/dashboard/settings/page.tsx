import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar"
import { SettingsView } from "@/components/dashboard/settings-view"

export default function SettingsPage() {
  return (
    <>
      <DashboardTopbar title="Settings" />
      <main className="flex-1 p-4 sm:p-6">
        <div className="mx-auto w-full max-w-3xl">
          <p className="mb-6 text-sm text-muted-foreground">
            Manage your organization, recipient branding, and API access.
          </p>
          <SettingsView />
        </div>
      </main>
    </>
  )
}
