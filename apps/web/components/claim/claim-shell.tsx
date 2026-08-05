import type { ReactNode } from "react"
import { Logo } from "@/components/logo"
import { ShieldCheck } from "lucide-react"

export function ClaimShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-[color-mix(in_oklab,var(--brand),var(--background)_88%)]">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border">
          <ShieldCheck className="size-3.5 text-[color-mix(in_oklab,var(--brand),black_25%)]" />
          Secured by Stellar
        </span>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-2 sm:items-center sm:pt-0">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}
