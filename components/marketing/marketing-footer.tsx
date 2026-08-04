import Link from 'next/link'
import { Logo } from '@/components/logo'

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'How it works', href: '/#how-it-works' },
      { label: 'Use cases', href: '/#use-cases' },
      { label: 'Demo claim', href: '/claim/demo-active' },
      { label: 'Dashboard', href: '/dashboard' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'Documentation', href: '/developers' },
      { label: 'API reference', href: '/developers' },
      { label: 'Webhooks', href: '/developers' },
      { label: 'Status', href: '/developers' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/' },
      { label: 'Security', href: '/#security' },
      { label: 'Privacy', href: '/' },
      { label: 'Terms', href: '/' },
    ],
  },
]

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Walletless USDC payouts on Stellar, with local cash-out through rails like PIX. Built
              for Latin America.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold">{col.title}</h3>
              <ul className="mt-4 flex flex-col gap-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Vaivém. Not a bank. USDC is issued by Circle.</p>
          <p>Powered by Stellar</p>
        </div>
      </div>
    </footer>
  )
}
