import type { ReactNode } from 'react'
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dark flex min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(34,197,94,0.12),_transparent_55%)]" />
      <DashboardSidebar />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
