import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/logo'
import { ClaimCardPreview } from '@/components/claim-card-preview'

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand panel */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-navy p-10 text-navy-foreground lg:flex">
        <Link href="/" aria-label="ClaimLink home">
          <Logo wordmarkClassName="text-navy-foreground" />
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <ClaimCardPreview className="rotate-1 shadow-2xl" />
        </div>
        <div>
          <div className="flex items-center gap-2 text-sm text-navy-foreground/70">
            <ShieldCheck className="size-4 text-brand" />
            Funds locked on Stellar · Refundable anytime
          </div>
          <p className="mt-4 max-w-sm text-pretty text-lg leading-relaxed">
            &ldquo;We paid 40 hackathon winners across Brazil in one afternoon — no wallets, no
            wires.&rdquo;
          </p>
          <p className="mt-2 text-sm text-navy-foreground/60">Marina Alves · Brazil Builders</p>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex flex-1 flex-col">
        <div className="flex items-center justify-between p-6 lg:hidden">
          <Link href="/" aria-label="ClaimLink home">
            <Logo />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  )
}
