'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

/** Reveals `text` once `start` is true. Instant under reduced motion. */
export function useTyped(text: string, start: boolean) {
  const reduce = useReducedMotion()
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!start) return
    if (reduce) {
      setN(text.length)
      return
    }
    let i = 0
    const id = window.setInterval(() => {
      i += 4
      setN(Math.min(text.length, i))
      if (i >= text.length) window.clearInterval(id)
    }, 16)
    return () => window.clearInterval(id)
  }, [start, text, reduce])
  return text.slice(0, n)
}

const RATES = {
  BR: { cur: 'R$', code: 'BRL', rail: 'PIX', rate: 5.13 },
  MX: { cur: '$', code: 'MXN', rail: 'SPEI', rate: 18.42 },
} as const
type Corridor = keyof typeof RATES
const FEE_BPS = 20

/** A payout receipt that reprints as you move the slider. */
export function AsciiReceipt({ className }: { className?: string }) {
  const t = useTranslations('landing')
  const locale = useLocale()
  const [amount, setAmount] = useState(100)
  const [country, setCountry] = useState<Corridor>('BR')
  const [printKey, setPrintKey] = useState(0)

  const r = RATES[country]
  const lines = useMemo(() => {
    const nf = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const receive = amount * r.rate * (1 - FEE_BPS / 10000)
    const labels = [t('simSend'), t('simFee'), t('simRate'), t('simReceive')]
    const pad = Math.max(...labels.map((l) => l.length)) + 2
    const rows = [
      [labels[0]!, `${nf.format(amount)} USDC`],
      [labels[1]!, `${(FEE_BPS / 100).toFixed(2)}%`],
      [labels[2]!, `1 USDC = ${r.rate.toFixed(2)} ${r.code}`],
      [labels[3]!, `${r.cur} ${nf.format(receive)} · ${r.rail}`],
    ].map(([l, v]) => `${l!.padEnd(pad)}${v}`)
    const inner = Math.max(32, ...rows.map((x) => x.length)) + 2
    const rule = `+${'-'.repeat(inner)}+`
    const fmt = (s: string) => `| ${s.padEnd(inner - 2)} |`
    return [
      { text: rule, tone: 'rule' },
      { text: fmt('CLAIM 7KQ2-X9'), tone: 'head' },
      { text: rule, tone: 'rule' },
      ...rows.map((x, i) => ({ text: fmt(x), tone: i === 3 ? 'hot' : 'row' })),
      { text: rule, tone: 'rule' },
    ]
  }, [amount, r, locale, t])

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="lp-label">{t('simTitle')}</p>
        <div role="group" aria-label="Corridor" className="flex border border-[var(--lp-line-strong)] text-xs">
          {(['BR', 'MX'] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={country === c}
              onClick={() => {
                setCountry(c)
                setPrintKey((k) => k + 1)
              }}
              className={cn(
                'lp-mono px-3 py-1.5 transition-colors',
                country === c
                  ? 'bg-[var(--lp-lime)] text-black'
                  : 'text-[var(--lp-muted)] hover:text-[var(--lp-text)]',
              )}
            >
              {c === 'BR' ? 'BR / PIX' : 'MX / SPEI'}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-3 text-sm">
        <span className="flex items-baseline justify-between">
          <span className="text-[var(--lp-muted)]">{t('simAmount')}</span>
          <span className="lp-mono text-2xl tabular-nums">{amount}</span>
        </span>
        <input
          type="range"
          min={10}
          max={500}
          step={10}
          value={amount}
          onChange={(e) => {
            setAmount(Number(e.target.value))
            setPrintKey((k) => k + 1)
          }}
          className="lp-range text-[var(--lp-lime)]"
        />
      </label>

      <pre
        key={printKey}
        className="lp-print lp-mono overflow-x-auto border border-[var(--lp-line)] bg-[var(--lp-bg)] p-4 text-[12px] leading-[1.65] sm:text-[13px]"
        aria-live="polite"
      >
        {lines.map((l, i) => (
          <span
            key={i}
            className={cn(
              'block',
              l.tone === 'rule' && 'text-[var(--lp-line-strong)]',
              l.tone === 'head' && 'text-[var(--lp-muted)]',
              l.tone === 'hot' && 'text-[var(--lp-lime)]',
            )}
          >
            {l.text}
          </span>
        ))}
      </pre>
      <p className="text-xs text-[var(--lp-muted)]">{t('simNote')}</p>
    </div>
  )
}
