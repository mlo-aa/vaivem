import type { ReactNode } from "react"
import { Logo } from "@/components/logo"

/**
 * Recipient chrome for /claim/*.
 * "Demonstração" only when DEMO_MODE — otherwise the kit shows DEMO only on
 * simulated hops (mock quote / simulated KYC).
 */
export function ClaimShell({ children }: { children: ReactNode }) {
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true"

  return (
    <div className="flex min-h-svh flex-col bg-[color-mix(in_oklab,var(--brand),var(--background)_88%)]">
      <header className="flex flex-col gap-2 px-3 py-3 sm:px-6 sm:py-4">
        <Logo />
        <div className="flex flex-wrap gap-2">
          {demoMode ? (
            <span className="inline-flex items-center rounded-full border border-warning/40 bg-warning/15 px-2.5 py-1 text-[11px] font-semibold text-warning-foreground">
              Demonstração
            </span>
          ) : null}
          <span className="inline-flex items-center rounded-full bg-background/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
            Só é liberado para você
          </span>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-3 pb-16 pt-2 sm:items-center sm:px-4 sm:pt-0">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}
