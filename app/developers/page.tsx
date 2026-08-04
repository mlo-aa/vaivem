import { MarketingHeader } from "@/components/marketing/marketing-header"
import { MarketingFooter } from "@/components/marketing/marketing-footer"
import { DevelopersView } from "@/components/developers/developers-view"

export const metadata = {
  title: "Developers · ClaimLink",
  description: "Integrate walletless USDC payouts with a single REST API.",
}

export default function DevelopersPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader />
      <main className="flex-1">
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
            <p className="font-mono text-sm text-brand">Developers</p>
            <h1 className="mt-2 max-w-2xl text-balance text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
              Payouts infrastructure for builders
            </h1>
            <p className="mt-4 max-w-xl text-pretty text-muted-foreground">
              Send money to anyone with one API call. We handle escrow, FX, compliance, and the
              recipient experience — you ship faster.
            </p>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
          <DevelopersView />
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}
