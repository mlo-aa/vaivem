import Link from 'next/link'
import {
  ArrowRight,
  Award,
  Banknote,
  Gift,
  HandCoins,
  Link2,
  Lock,
  MousePointerClick,
  RefreshCcw,
  ShieldCheck,
  Ticket,
  Users,
  Wallet,
} from 'lucide-react'
import { ButtonLink } from '@/components/ui/button-link'
import { MarketingHeader } from '@/components/marketing/marketing-header'
import { MarketingFooter } from '@/components/marketing/marketing-footer'
import { ClaimCardPreview } from '@/components/claim-card-preview'

const STEPS = [
  {
    icon: HandCoins,
    title: 'Create a payout',
    body: 'Set an amount in BRL or USD, fund it in USDC, and add optional protection.',
  },
  {
    icon: Link2,
    title: 'Share the link',
    body: 'Send it over WhatsApp, email, or a QR code. No accounts required to open it.',
  },
  {
    icon: MousePointerClick,
    title: 'Recipient claims or cashes out',
    body: 'They keep USDC in a free Stellar wallet or withdraw locally through PIX.',
  },
]

const USE_CASES = [
  { icon: Award, label: 'Hackathon prizes' },
  { icon: Banknote, label: 'Freelancer payments' },
  { icon: Users, label: 'Community rewards' },
  { icon: RefreshCcw, label: 'Refunds' },
  { icon: Gift, label: 'Grants' },
  { icon: Ticket, label: 'Event incentives' },
  { icon: HandCoins, label: 'Aid disbursements' },
]

const TRUST = [
  {
    icon: ShieldCheck,
    title: 'Protected links',
    body: 'Lock claims to an email or an access code so only the right person can open them.',
  },
  {
    icon: Lock,
    title: 'Funds locked on Stellar',
    body: 'Payouts are backed on-chain the moment they are created — fully auditable, refundable anytime.',
  },
  {
    icon: Wallet,
    title: 'Walletless by design',
    body: 'Recipients never install anything. Vaivém sponsors the account and the trustline.',
  },
]

const CODE = `const claim = await vaivem.create({
  amount: "100",
  asset: "USDC",
  country: "BR",
  recipientEmail: "winner@example.com",
  payoutOptions: ["stellar", "pix"]
})`

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-background">
      <MarketingHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="size-1.5 rounded-full bg-brand" />
                USDC payouts for Latin America
              </span>
              <h1 className="mt-5 text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
                Send USDC with a link.
              </h1>
              <p className="mt-5 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground">
                Create walletless payouts that recipients can claim on Stellar or withdraw through
                regional payment rails such as PIX.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink size="lg" href="/dashboard">
                  Create a claim link
                  <ArrowRight data-icon="inline-end" />
                </ButtonLink>
                <ButtonLink size="lg" variant="outline" href="/claim/demo-active">
                  View demo claim
                </ButtonLink>
              </div>
              <p className="mt-6 text-sm text-muted-foreground">
                No wallet installs · Sponsored accounts · Cash out in 1–5 minutes
              </p>
            </div>

            <div className="relative flex justify-center lg:justify-end">
              <div
                className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-accent/40 blur-2xl"
                aria-hidden="true"
              />
              <ClaimCardPreview />
            </div>
          </div>
        </section>

        {/* Steps */}
        <section id="how-it-works" className="border-t border-border bg-card/40">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <div className="max-w-2xl">
              <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                From payout to payday in three steps
              </h2>
              <p className="mt-3 text-pretty text-muted-foreground">
                Vaivém handles the crypto so your recipients never have to think about it.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <div key={step.title} className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center justify-between">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-brand/15 text-[color-mix(in_oklab,var(--brand),black_40%)]">
                      <step.icon className="size-5" />
                    </span>
                    <span className="font-mono text-sm text-muted-foreground">0{i + 1}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Use cases */}
        <section id="use-cases" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                  One link for every kind of payout
                </h2>
                <p className="mt-3 text-pretty text-muted-foreground">
                  Teams use Vaivém to move money to people who don&apos;t have — or don&apos;t
                  want — a crypto wallet.
                </p>
              </div>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {USE_CASES.map((uc) => (
                <div
                  key={uc.label}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4"
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-foreground">
                    <uc.icon className="size-4.5" />
                  </span>
                  <span className="text-sm font-medium">{uc.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Developer */}
        <section className="border-t border-border bg-navy text-navy-foreground">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-navy-foreground/70">
                Developer SDK
              </span>
              <h2 className="mt-5 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                Payouts in a few lines of code
              </h2>
              <p className="mt-4 max-w-md text-pretty leading-relaxed text-navy-foreground/70">
                Drop Vaivém into your product and let your users send USDC that anyone can claim
                or cash out. Full REST API, typed SDK, and webhooks.
              </p>
              <ButtonLink className="mt-8" variant="secondary" href="/developers">
                Read the docs
                <ArrowRight data-icon="inline-end" />
              </ButtonLink>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-1.5 shadow-2xl">
              <div className="flex items-center gap-1.5 px-3 py-2.5">
                <span className="size-2.5 rounded-full bg-white/20" />
                <span className="size-2.5 rounded-full bg-white/20" />
                <span className="size-2.5 rounded-full bg-white/20" />
              </div>
              <pre className="overflow-x-auto rounded-xl bg-black/40 p-5 font-mono text-sm leading-relaxed text-navy-foreground/90">
                <code>{CODE}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* Trust & security */}
        <section id="security" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <div className="max-w-2xl">
              <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                Trust built into every link
              </h2>
              <p className="mt-3 text-pretty text-muted-foreground">
                Recipients feel safe clicking, and senders stay in control of their funds.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {TRUST.map((item) => (
                <div key={item.title} className="rounded-2xl border border-border bg-card p-6">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <item.icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border bg-card/40">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <div className="flex flex-col items-center gap-6 rounded-3xl border border-border bg-card px-6 py-12 text-center">
              <h2 className="max-w-xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                Send your first walletless payout today
              </h2>
              <p className="max-w-md text-pretty text-muted-foreground">
                Create a protected claim link in under a minute. Your recipient claims it with just a
                link.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <ButtonLink size="lg" href="/dashboard">
                  Create a claim link
                  <ArrowRight data-icon="inline-end" />
                </ButtonLink>
                <ButtonLink size="lg" variant="outline" href="/dashboard">
                  Explore the dashboard
                </ButtonLink>
              </div>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  )
}
