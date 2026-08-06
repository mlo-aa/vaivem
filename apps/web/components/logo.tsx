import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  showWordmark?: boolean
  wordmarkClassName?: string
}

/** Icon mark only — black on transparent; inverted in dark mode. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt=""
      width={136}
      height={146}
      className={cn('h-8 w-auto dark:invert', className)}
      priority
    />
  )
}

/**
 * Brand lockup.
 * - showWordmark (default): full logotype
 * - showWordmark=false: icon mark only
 */
export function Logo({ className, showWordmark = true, wordmarkClassName }: LogoProps) {
  if (!showWordmark) {
    return <LogoMark className={className} />
  }

  return (
    <Image
      src="/logotype.png"
      alt="Vaivém"
      width={255}
      height={59}
      className={cn('h-7 w-auto sm:h-8 dark:invert', className, wordmarkClassName)}
      priority
    />
  )
}
