import type { ClaimStatus } from './types'

// USD -> BRL reference rate used across the mocked quoting engine.
export const USD_TO_BRL = 5.045
export const PROVIDER_FEE_PCT = 0.014 // 1.4%
export const NETWORK_FEE_USDC = 0.02

export function formatUSDC(value: number): string {
  return `${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USDC`
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function formatUSD(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
}

export function formatDisplay(value: number, currency: 'BRL' | 'USD'): string {
  return currency === 'BRL' ? formatBRL(value) : formatUSD(value)
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export function timeUntil(iso: string): {
  expired: boolean
  label: string
  days: number
  hours: number
  minutes: number
  seconds: number
} {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) {
    return { expired: true, label: 'Expired', days: 0, hours: 0, minutes: 0, seconds: 0 }
  }
  const seconds = Math.floor(diff / 1000) % 60
  const minutes = Math.floor(diff / 60000) % 60
  const hours = Math.floor(diff / 3600000) % 24
  const days = Math.floor(diff / 86400000)
  const label =
    days > 0
      ? `${days}d ${hours}h left`
      : hours > 0
        ? `${hours}h ${minutes}m left`
        : `${minutes}m ${seconds}s left`
  return { expired: false, label, days, hours, minutes, seconds }
}

export function maskEmail(email: string): string {
  const [name, domain] = email.split('@')
  if (!domain) return email
  const visible = name.slice(0, 2)
  return `${visible}${'•'.repeat(Math.max(name.length - 2, 2))}@${domain}`
}

export function maskCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return cpf
  return `•••.${digits.slice(3, 6)}.•••-${digits.slice(9)}`
}

export function maskStellarAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-6)}`
}

export function maskPixKey(key: string, type: string): string {
  if (type === 'email') return maskEmail(key)
  if (type === 'cpf') return maskCPF(key)
  const clean = key.replace(/\s/g, '')
  return `${clean.slice(0, 3)}••••${clean.slice(-2)}`
}

interface StatusMeta {
  label: string
  // maps to Badge visual treatment
  tone: 'brand' | 'info' | 'warning' | 'muted' | 'destructive' | 'success'
}

export const STATUS_META: Record<ClaimStatus, StatusMeta> = {
  draft: { label: 'Draft', tone: 'muted' },
  funded: { label: 'Funded', tone: 'info' },
  shared: { label: 'Shared', tone: 'info' },
  viewed: { label: 'Viewed', tone: 'info' },
  claimed: { label: 'Claimed', tone: 'brand' },
  cashing_out: { label: 'Cashing out', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
  expired: { label: 'Expired', tone: 'muted' },
  refunded: { label: 'Refunded', tone: 'muted' },
  cancelled: { label: 'Cancelled', tone: 'destructive' },
}

export function isActiveStatus(status: ClaimStatus): boolean {
  return ['funded', 'shared', 'viewed', 'claimed', 'cashing_out'].includes(status)
}
