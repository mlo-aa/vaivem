/**
 * lib/server/etherfuse.ts
 *
 * SOLO SERVIDOR. Nunca importar desde un componente cliente ni desde
 * lib/adapters — la API key da acceso a toda la organización.
 *
 * Parámetros verificados contra api.sand.etherfuse.com.
 */

import "server-only"

const BASE_URL = process.env.ETHERFUSE_BASE_URL ?? "https://api.sand.etherfuse.com"
const API_KEY = process.env.ETHERFUSE_API_KEY
const ORG_ID = process.env.ETHERFUSE_ORG_ID

/** Identificadores de SANDBOX. Distintos en producción. */
export const SANDBOX_ASSETS = {
  USDC: "USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  TESOURO: "TESOURO:GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4",
  MEXe: "MEXe:GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4",
} as const

export interface RawQuote {
  quoteId: string
  blockchain: string
  quoteAssets: { type: string; sourceAsset: string; targetAsset: string }
  sourceAmount: string
  destinationAmount: string
  exchangeRate: string
  etherfuseMidMarketRate: string
  nominalRate: string
  feeBps: string
  feeAmount: string // en el ACTIVO ORIGEN (USDC), no en fiat
  requiresSwap: boolean
  createdAt: string
  expiresAt: string // 2 minutos exactos
}

export class EtherfuseError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = "EtherfuseError"
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_KEY) throw new EtherfuseError("ETHERFUSE_API_KEY no configurada", 500)

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      // Sin prefijo "Bearer": la API lo rechaza explícitamente.
      Authorization: API_KEY,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  })

  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }

  if (!res.ok) {
    const msg =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Etherfuse ${res.status}`
    throw new EtherfuseError(msg, res.status)
  }

  return body as T
}

/** Verifica la key. Útil para un health check. */
export function me() {
  return request<{ id: string; displayName: string; approvedAt: string }>("/ramp/me")
}

/**
 * Los tres parámetros son obligatorios pese a lo que sugiere la doc:
 * omitir cualquiera devuelve "Query deserialize error: missing field".
 */
export async function listAssets(params: {
  blockchain: string
  currency: string
  wallet: string
}) {
  const qs = new URLSearchParams(params)
  const res = await request<{ assets: unknown[] }>(`/ramp/assets?${qs}`)
  return res.assets
}

/** Cotización real. Expira a los 2 minutos. */
export function createQuote(params: {
  type: "onramp" | "offramp"
  sourceAsset: string
  targetAsset: string
  sourceAmount: string
  customerId?: string
  /** When set, used as quoteId (and later as orderId). Otherwise a UUID is generated. */
  quoteId?: string
}) {
  if (!ORG_ID && !params.customerId) {
    throw new EtherfuseError("ETHERFUSE_ORG_ID no configurada", 500)
  }
  const quoteId = params.quoteId ?? crypto.randomUUID()
  return request<RawQuote>("/ramp/quote", {
    method: "POST",
    body: JSON.stringify({
      quoteId,
      customerId: params.customerId ?? ORG_ID,
      blockchain: "stellar",
      quoteAssets: {
        type: params.type,
        sourceAsset: params.sourceAsset,
        targetAsset: params.targetAsset,
      },
      sourceAmount: params.sourceAmount,
    }),
  })
}

export interface OfframpOrderResult {
  offramp: {
    orderId: string
    withdrawAnchorAccount: string
    withdrawMemo: string
    withdrawMemoType: "hash" | string
  }
}

/**
 * Creates an offramp order. orderId MUST equal quoteId (verified against sandbox).
 * Field is `publicKey` — not `walletAddress`.
 */
export function createOrder(params: {
  quoteId: string
  bankAccountId: string
  publicKey: string
  customerId?: string
  useAnchor?: boolean
}) {
  if (!ORG_ID && !params.customerId) {
    throw new EtherfuseError("ETHERFUSE_ORG_ID no configurada", 500)
  }
  return request<OfframpOrderResult>("/ramp/order", {
    method: "POST",
    body: JSON.stringify({
      orderId: params.quoteId,
      quoteId: params.quoteId,
      customerId: params.customerId ?? ORG_ID,
      bankAccountId: params.bankAccountId,
      publicKey: params.publicKey,
      useAnchor: params.useAnchor ?? true,
    }),
  })
}

export interface RampOrderStatus {
  orderId?: string
  status: string
  [key: string]: unknown
}

/** Poll until status === "completed" (caller loops). */
export function getOrder(orderId: string) {
  return request<RampOrderStatus>(`/ramp/order/${encodeURIComponent(orderId)}`)
}

export function getEtherfuseOrgId(): string | undefined {
  return ORG_ID
}

export function getUsdcAssetId(): string {
  return process.env.ETHERFUSE_USDC_ASSET ?? SANDBOX_ASSETS.USDC
}

export function requireBankAccountId(): string {
  const id = process.env.ETHERFUSE_BRL_BANK_ACCOUNT_ID
  if (!id) {
    throw new EtherfuseError("ETHERFUSE_BRL_BANK_ACCOUNT_ID no configurada", 500)
  }
  return id
}