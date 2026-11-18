'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

/** Endless tape of ascii; pauses on hover. */
export function AsciiTicker({ items, className }: { items: string[]; className?: string }) {
  const row = (key: string) => (
    <div key={key} className="flex shrink-0 gap-10 pr-10" aria-hidden={key === 'b'}>
      {items.map((s, i) => (
        <span key={i} className="whitespace-pre">
          {s}
        </span>
      ))}
    </div>
  )
  return (
    <div className={cn('lp-marquee', className)}>
      <div className="lp-marquee-track">
        {row('a')}
        {row('b')}
      </div>
    </div>
  )
}

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
  const text = useMemo(() => {
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
    const inner = Math.max(30, ...rows.map((x) => x.length)) + 2
    const line = `+${'-'.repeat(inner)}+`
    const head = `CLAIM 7KQ2-X9`
    const fmt = (s: string) => `| ${s.padEnd(inner - 2)} |`
    return [line, fmt(head), line, ...rows.map(fmt), line].join('\n')
  }, [amount, r, locale, t])

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="lp-pixel text-xl">{t('simTitle')}</p>
        <div role="group" aria-label="Corridor" className="flex gap-2 text-sm">
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
                'border-2 border-current px-3 py-1 font-bold transition-[transform,background-color] active:translate-y-px',
                country === c ? 'bg-[var(--lp-cobalt)] text-[var(--lp-bone)]' : 'hover:bg-black/10',
              )}
            >
              {c === 'BR' ? 'BR · PIX' : 'MX · SPEI'}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-3 text-sm">
        <span className="flex items-baseline justify-between">
          <span>{t('simAmount')}</span>
          <span className="lp-num text-2xl tabular-nums">{amount}</span>
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
          className="lp-range"
        />
      </label>

      <pre
        key={printKey}
        className="lp-print overflow-x-auto bg-[var(--lp-ink)] p-4 text-[12px] leading-[1.55] text-[var(--lp-lime)] sm:text-[13px]"
        aria-live="polite"
      >
        {text}
      </pre>
      <p className="text-xs opacity-70">{t('simNote')}</p>
    </div>
  )
}
