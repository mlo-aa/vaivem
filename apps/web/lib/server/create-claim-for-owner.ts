import "server-only"

import {
  createClaimableBalance,
  createSponsoredAccount,
  generateRecipientKeypair,
  StellarError,
} from "@/lib/server/stellar"
import { recipientSecretsByBalanceId } from "@/lib/server/claim-secrets"
import {
  generateClaimToken,
  saveStoredClaim,
  type StoredClaim,
} from "@/lib/server/claim-store"
import type { ProtectionType } from "@/lib/types"
import { isBelowMinimum, minAmountMessage, MIN_AMOUNT_USDC } from "@/lib/limits"
import { debitForClaim, getBalance } from "@/lib/server/balance-store"

export type CreateClaimInput = {
  amount: number
  country?: string
  recipientName: string
  recipientEmail?: string | null
  message?: string | null
  protectionType?: ProtectionType
  accessCode?: string | null
  expirationDays?: number
  displayCurrency?: "BRL" | "USD"
  displayAmount?: number
  purpose?: string
  reference?: string | null
  batchId?: string | null
  allowPix?: boolean
  allowStellar?: boolean
}

export type CreateClaimSuccess = {
  token: string
  url: string
  deadline: number
  balanceId: string
  hash: string
  amount: number
  ownerId: string
  senderName: string
  batchId: string | null
  status: "funded"
  claimUrl: string
  id: string
  createdAt: string
}

export type CreateClaimFailure = {
  error: string
  message?: string
  status: number
  available?: number
  required?: number
  minAmountUsdc?: number
}

export async function createClaimForOwner(
  owner: { ownerId: string; name: string | null; email: string | null },
  body: CreateClaimInput,
): Promise<
  | { ok: true; data: CreateClaimSuccess }
  | { ok: false; failure: CreateClaimFailure }
> {
  try {
    const amount = Number(body.amount)
    const country = String(body.country ?? "BR")
    const senderName = owner.name?.trim() || owner.email || "Vaivém sender"
    const recipientName = String(body.recipientName ?? "")
    const recipientEmail =
      body.recipientEmail != null ? String(body.recipientEmail) : null
    const message = body.message != null ? String(body.message) : null
    const protectionType = (body.protectionType ?? "public") as ProtectionType
    const accessCode =
      protectionType === "code" && body.accessCode
        ? String(body.accessCode)
        : null
    const expirationDays = Number(body.expirationDays ?? 7)
    const displayCurrency = body.displayCurrency === "USD" ? "USD" : "BRL"
    const displayAmount = Number(body.displayAmount ?? amount)
    const purpose = String(body.purpose ?? "Payout")
    const reference = body.reference != null ? String(body.reference) : null
    const batchId =
      body.batchId != null && String(body.batchId).trim()
        ? String(body.batchId).trim().slice(0, 64)
        : null
    const allowPix = body.allowPix !== false
    const allowStellar = body.allowStellar !== false

    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        ok: false,
        failure: {
          error: "amount_invalid",
          message: "amount must be a positive number (USDC)",
          status: 400,
        },
      }
    }
    if (!allowPix && !allowStellar) {
      return {
        ok: false,
        failure: {
          error: "at_least_one_rail",
          message: "at least one payout rail must be allowed",
          status: 400,
        },
      }
    }
    if (allowPix && isBelowMinimum(amount)) {
      return {
        ok: false,
        failure: {
          error: "amount_below_minimum",
          message: minAmountMessage(displayCurrency),
          status: 422,
          minAmountUsdc: MIN_AMOUNT_USDC,
        },
      }
    }
    if (recipientName.trim().length < 2) {
      return {
        ok: false,
        failure: {
          error: "recipientName_required",
          message: "recipientName required",
          status: 400,
        },
      }
    }
    if (protectionType === "code" && (!accessCode || accessCode.length < 4)) {
      return {
        ok: false,
        failure: {
          error: "accessCode_required",
          message: "accessCode required for code protection",
          status: 400,
        },
      }
    }
    if (!Number.isFinite(expirationDays) || expirationDays <= 0) {
      return {
        ok: false,
        failure: {
          error: "expirationDays_invalid",
          message: "expirationDays invalid",
          status: 400,
        },
      }
    }

    const balance = await getBalance(owner.ownerId)
    if (balance.amount + 1e-9 < amount) {
      return {
        ok: false,
        failure: {
          error: "insufficient_balance",
          message: `Insufficient balance. You have ${balance.amount.toFixed(2)} USDC and need ${amount.toFixed(2)} USDC.`,
          status: 402,
          available: balance.amount,
          required: amount,
        },
      }
    }

    const expiresInSeconds = Math.floor(expirationDays * 86400)
    const amountStr = amount.toFixed(2)

    const recipient = generateRecipientKeypair()
    await createSponsoredAccount(recipient.publicKey, recipient.secret)

    const { balanceId, hash, deadline } = await createClaimableBalance(
      recipient.publicKey,
      amountStr,
      expiresInSeconds,
    )

    await recipientSecretsByBalanceId.set(balanceId, recipient.secret, deadline)

    const token = generateClaimToken()
    try {
      await debitForClaim(owner.ownerId, amount, token)
    } catch (err) {
      if (err instanceof Error && err.message === "insufficient_balance") {
        return {
          ok: false,
          failure: {
            error: "insufficient_balance",
            message: "Insufficient balance.",
            status: 402,
          },
        }
      }
      throw err
    }

    const now = new Date().toISOString()
    const record: StoredClaim = {
      token,
      ownerId: owner.ownerId,
      balanceId,
      recipientPublicKey: recipient.publicKey,
      amount,
      country,
      senderName,
      recipientName,
      recipientEmail,
      message,
      protectionType,
      accessCode,
      status: "shared",
      deadline,
      createdAt: now,
      claimedAt: null,
      payoutMethod: null,
      payoutOrderId: null,
      txHash: hash,
      displayCurrency,
      displayAmount,
      purpose,
      reference,
      batchId,
      expiresAt: new Date(deadline * 1000).toISOString(),
    }
    await saveStoredClaim(record)

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000")
    const claimUrl = `${appUrl.replace(/\/$/, "")}/claim/${token}`

    return {
      ok: true,
      data: {
        id: `clm_${token}`,
        token,
        url: claimUrl,
        claimUrl,
        deadline,
        balanceId,
        hash,
        amount,
        ownerId: owner.ownerId,
        senderName,
        batchId,
        status: "funded",
        createdAt: now,
      },
    }
  } catch (err) {
    const message =
      err instanceof StellarError
        ? err.message
        : err instanceof Error
          ? err.message
          : "unknown_error"
    console.error("[createClaimForOwner]", message)
    return {
      ok: false,
      failure: { error: "create_failed", message, status: 502 },
    }
  }
}

export function serializeClaimForApi(c: StoredClaim) {
  return {
    id: `clm_${c.token}`,
    token: c.token,
    status: c.status,
    amount: {
      asset: "USDC",
      value: String(c.amount),
    },
    displayAmount: c.displayAmount ?? c.amount,
    displayCurrency: c.displayCurrency ?? "USD",
    country: c.country,
    senderName: c.senderName,
    recipient: {
      name: c.recipientName,
      email: c.recipientEmail,
    },
    protection: c.protectionType,
    purpose: c.purpose ?? "Payout",
    reference: c.reference ?? null,
    batchId: c.batchId ?? null,
    claimUrl: (() => {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ??
        (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000")
      return `${appUrl.replace(/\/$/, "")}/claim/${c.token}`
    })(),
    stellarTransactionHash: c.txHash,
    balanceId: c.balanceId,
    expiresAt: c.expiresAt ?? new Date(c.deadline * 1000).toISOString(),
    createdAt: c.createdAt,
    claimedAt: c.claimedAt,
    payoutMethod: c.payoutMethod,
  }
}
