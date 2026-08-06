import { en } from "./en"
import { es } from "./es"
import { ptBR } from "./pt-BR"

export type KitLocale = "en" | "es" | "pt-BR"
export type KitMessages = typeof en

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly (infer U)[]
    ? readonly U[]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K]
}

export const defaultMessages: Record<KitLocale, KitMessages> = {
  en,
  es,
  "pt-BR": ptBR,
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function deepMerge<T>(base: T, override?: DeepPartial<T>): T {
  if (override === undefined) return base
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override as T) ?? base
  }
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue
    const current = result[key]
    result[key] =
      isPlainObject(current) && isPlainObject(value)
        ? deepMerge(current, value as DeepPartial<typeof current>)
        : value
  }
  return result as T
}

export function resolveMessages(
  locale?: KitLocale,
  override?: DeepPartial<KitMessages>,
): KitMessages {
  const base = defaultMessages[locale ?? "en"] ?? defaultMessages.en
  return deepMerge(base, override)
}

export { en } from "./en"
export { es } from "./es"
export { ptBR } from "./pt-BR"
