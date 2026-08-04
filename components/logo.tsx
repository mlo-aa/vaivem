import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  showWordmark?: boolean
  wordmarkClassName?: string
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-[0.5rem] bg-navy text-navy-foreground',
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-[62%]">
        <path
          d="M9.5 14.5L14.5 9.5"
          stroke="var(--brand)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M12.5 7.5L13.9 6.1a3.4 3.4 0 0 1 4.8 4.8l-1.4 1.4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M11.5 16.5L10.1 17.9a3.4 3.4 0 0 1-4.8-4.8l1.4-1.4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

export function Logo({ className, showWordmark = true, wordmarkClassName }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className="size-8" />
      {showWordmark && (
        <span className={cn('text-lg font-semibold tracking-tight text-foreground', wordmarkClassName)}>
          ClaimLink
        </span>
      )}
    </span>
  )
}
