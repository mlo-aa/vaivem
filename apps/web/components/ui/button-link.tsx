import type { ComponentProps } from 'react'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'

type ButtonProps = ComponentProps<typeof Button>

interface ButtonLinkProps extends Omit<ButtonProps, 'render' | 'nativeButton'> {
  href: string
  target?: string
  rel?: string
}

/**
 * A Button that renders as a locale-aware Link. Base UI needs `nativeButton={false}`
 * when the rendered element is not a native <button>.
 */
export function ButtonLink({ href, target, rel, children, ...props }: ButtonLinkProps) {
  return (
    <Button {...props} nativeButton={false} render={<Link href={href} target={target} rel={rel} />}>
      {children}
    </Button>
  )
}
