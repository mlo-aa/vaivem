"use client"

import {
  createContext,
  createElement,
  useContext,
  type ReactNode,
} from "react"
import type { KitMessages } from "./messages"
import { defaultMessages } from "./messages"

const KitMessagesContext = createContext<KitMessages | null>(null)

export function KitMessagesProvider({
  messages,
  children,
}: {
  messages: KitMessages
  children: ReactNode
}) {
  return createElement(KitMessagesContext.Provider, { value: messages }, children)
}

export function useKitMessages(): KitMessages {
  const ctx = useContext(KitMessagesContext)
  if (!ctx) {
    return defaultMessages.en
  }
  return ctx
}

/** Optional context read — null when no provider is mounted. */
export function useKitMessagesOptional(): KitMessages | null {
  return useContext(KitMessagesContext)
}

type Vars = Record<string, string | number>

function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split(".")
  let cur: unknown = obj
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key]
    return value === undefined ? `{${key}}` : String(value)
  })
}

/**
 * Look up a dotted path in the message catalog and optionally interpolate `{vars}`.
 * Returns the path itself when the lookup misses (dev-friendly fallback).
 */
export function t(messages: KitMessages, path: string, vars?: Vars): string {
  const value = getByPath(messages, path)
  if (typeof value !== "string") return path
  return interpolate(value, vars)
}
