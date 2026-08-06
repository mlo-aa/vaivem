'use client'

import { useReducedMotion } from 'framer-motion'
import { motion, type Variants } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

const enterVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
}

export function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const reduce = useReducedMotion()

  if (reduce) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-10% 0px' }}
      variants={enterVariants}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

export function Stagger({
  children,
  className,
  stagger = 0.06,
}: {
  children: ReactNode
  className?: string
  stagger?: number
}) {
  const reduce = useReducedMotion()

  if (reduce) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-10% 0px' }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger } },
      }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      variants={enterVariants}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

export function CountUp({
  to,
  className,
  duration = 0.4,
  suffix = '',
  prefix = '',
  decimals = 0,
}: {
  to: number
  className?: string
  duration?: number
  suffix?: string
  prefix?: string
  decimals?: number
}) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const [value, setValue] = useState(reduce ? to : 0)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (reduce || started) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setStarted(true)
          io.disconnect()
        }
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [reduce, started])

  useEffect(() => {
    if (!started || reduce) return
    const start = performance.now()
    const animMs = Math.min(duration * 1000, 400)
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / animMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(to * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
      else setValue(to)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [started, to, duration, reduce])

  const display =
    decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString()

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {prefix}
      {display}
      {suffix}
    </span>
  )
}

export function Typewriter({
  text,
  className,
  active,
}: {
  text: string
  className?: string
  active: boolean
}) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(reduce ? text.length : 0)

  useEffect(() => {
    if (reduce) {
      setShown(text.length)
      return
    }
    if (!active) {
      setShown(0)
      return
    }
    setShown(0)
    let i = 0
    const id = window.setInterval(() => {
      i += 2
      setShown(Math.min(text.length, i))
      if (i >= text.length) window.clearInterval(id)
    }, 12)
    return () => window.clearInterval(id)
  }, [active, text, reduce])

  return (
    <pre className={className}>
      <code>{text.slice(0, shown)}</code>
      {!reduce && shown < text.length ? (
        <span className="animate-pulse">▍</span>
      ) : null}
    </pre>
  )
}
