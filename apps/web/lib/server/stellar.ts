/**
 * lib/server/stellar.ts
 *
 * SOLO SERVIDOR. Nunca importar desde un componente cliente.
 * Primitivas portadas 1:1 desde spike/spike.mjs (verificadas en testnet).
 */

import "server-only"

import {
  Keypair,
  Horizon,
  TransactionBuilder,
  Operation,
  Asset,
  Networks,
  BASE_FEE,
  Claimant,
  Transaction,
  FeeBumpTransaction,
  Memo,
} from "@stellar/stellar-sdk"

export const HORIZON_URL = "https://horizon-testnet.stellar.org"
const NETWORK_PASSPHRASE = Networks.TESTNET

/** Etherfuse sandbox USDC issuer — the only asset credited for crypto deposits. */
export const ETHERFUSE_USDC_ISSUER =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

export class StellarError extends Error {
  constructor(
    message: string,
    readonly resultCodes?: {
      transaction?: string
      operations?: string[]
    },
  ) {
    super(message)
    this.name = "StellarError"
  }
}

export type StellarFailureCode =
  | "insufficient_balance"
  | "no_trustline"
  | "no_destination"
  | "stale_sequence"
  | "submit_timeout"
  | "submit_failed"

/**
 * Horizon result codes → plain language.
 *
 * Wording matters: the kit classifies a failed payout from the message it gets
 * back, so these must not contain "already", "expir" or "funded", which map to
 * unrelated failure screens.
 */
export function describeStellarFailure(err: unknown): {
  code: StellarFailureCode
  message: string
} {
  const raw = err instanceof Error ? err.message : String(err)
  const codes = err instanceof StellarError ? err.resultCodes : undefined
  const haystack = [codes?.transaction ?? "", ...(codes?.operations ?? []), raw]
    .join(" ")
    .toLowerCase()

  if (haystack.includes("op_underfunded")) {
    return {
      code: "insufficient_balance",
      message:
        "The sender wallet has insufficient Etherfuse-issued USDC to cover this payout. Top up the sponsor wallet and try again.",
    }
  }
  if (haystack.includes("op_no_trust")) {
    return {
      code: "no_trustline",
      message:
        "The destination account has no trustline for this USDC asset, so it cannot receive the payout.",
    }
  }
  if (haystack.includes("op_no_destination")) {
    return {
      code: "no_destination",
      message: "The payout destination account does not exist on the network.",
    }
  }
  if (haystack.includes("tx_bad_seq")) {
    return {
      code: "stale_sequence",
      message:
        "The payment was built on a stale account sequence and was not applied. Nothing was sent — try again.",
    }
  }
  if (haystack.includes("tx_too_late")) {
    return {
      code: "submit_timeout",
      message:
        "The payment timed out before reaching the network. Nothing was sent — try again.",
    }
  }
  return {
    code: "submit_failed",
    message: raw || "The payment could not be submitted to the network.",
  }
}

export interface AccountBalance {
  asset: string
  balance: string
}

export interface AccountState {
  publicKey: string
  balances: AccountBalance[]
  subentryCount: number
  numSponsoring: number
  numSponsored: number
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new StellarError(`${name} is not configured`)
  }
  return value
}

function getConfig() {
  const network = process.env.STELLAR_NETWORK ?? "testnet"
  if (network !== "testnet") {
    throw new StellarError(
      `STELLAR_NETWORK="${network}" is not supported yet; only "testnet" is configured`,
    )
  }
  return {
    sponsorSecret: requireEnv("STELLAR_SPONSOR_SECRET"),
    usdcIssuer: requireEnv("STELLAR_USDC_ISSUER"),
    network,
  }
}

function getServer() {
  return new Horizon.Server(HORIZON_URL)
}

function getSponsorKeypair() {
  return Keypair.fromSecret(getConfig().sponsorSecret)
}

function getUsdcAsset() {
  return new Asset("USDC", getConfig().usdcIssuer)
}

/** Etherfuse-issued USDC (sandbox circle issuer), not self-issued test USDC. */
function getEtherfuseUsdcAsset() {
  const raw =
    process.env.ETHERFUSE_USDC_ASSET ??
    `USDC:${ETHERFUSE_USDC_ISSUER}`
  const [code, issuer] = raw.includes(":") ? raw.split(":") : ["USDC", raw]
  if (!issuer) {
    throw new StellarError("ETHERFUSE_USDC_ASSET must be CODE:ISSUER or an issuer pubkey")
  }
  return new Asset(code, issuer)
}

export function getEtherfuseUsdcCodeIssuer(): { code: string; issuer: string } {
  const asset = getEtherfuseUsdcAsset()
  return {
    code: asset.getCode(),
    issuer: asset.getIssuer() || ETHERFUSE_USDC_ISSUER,
  }
}

export function getSponsorPublicKey(): string {
  return getSponsorKeypair().publicKey()
}

export function getHorizonServer() {
  return getServer()
}

/**
 * Pay the Etherfuse withdraw anchor with an exact hash memo.
 * Memo must be Memo.hash(Buffer.from(withdrawMemo, "base64")) — wrong memo
 * causes Etherfuse to auto-refund.
 */
export async function payAnchor(
  destination: string,
  memoBase64: string,
  amount: string,
): Promise<{ hash: string }> {
  const sponsor = getSponsorKeypair()
  const asset = getEtherfuseUsdcAsset()
  const server = getServer()
  const memo = Memo.hash(Buffer.from(memoBase64, "base64"))

  const acc = await server.loadAccount(sponsor.publicKey())
  const tx = new TransactionBuilder(acc, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination,
        asset,
        amount: String(amount),
      }),
    )
    .addMemo(memo)
    .setTimeout(120)
    .build()

  tx.sign(sponsor)
  const res = await submitTransaction(tx, "payAnchor")
  return { hash: res.hash }
}

function extractResultCodes(err: unknown): StellarError["resultCodes"] | undefined {
  if (!err || typeof err !== "object") return undefined
  const response = (err as { response?: { data?: { extras?: { result_codes?: unknown } } } })
    .response
  const codes = response?.data?.extras?.result_codes
  if (!codes || typeof codes !== "object") return undefined
  const c = codes as { transaction?: string; operations?: string[] }
  return {
    transaction: c.transaction,
    operations: c.operations,
  }
}

async function submitTransaction(
  tx: Transaction | FeeBumpTransaction,
  label: string,
) {
  const server = getServer()
  try {
    return await server.submitTransaction(tx)
  } catch (err) {
    const resultCodes = extractResultCodes(err)
    const detail = resultCodes
      ? JSON.stringify(resultCodes)
      : err instanceof Error
        ? err.message
        : String(err)
    throw new StellarError(`${label} failed: ${detail}`, resultCodes)
  }
}

/**
 * Server-only helper. Returns a secret — store it server-side only;
 * never log it or send it to the client.
 */
export function generateRecipientKeypair(): { publicKey: string; secret: string } {
  const kp = Keypair.random()
  return { publicKey: kp.publicKey(), secret: kp.secret() }
}

/**
 * Single transaction: beginSponsoringFutureReserves → createAccount(0) →
 * changeTrust(USDC) → endSponsoringFutureReserves.
 * Signed by BOTH sponsor and recipient.
 *
 * The recipient secret is required for co-signing (changeTrust / endSponsoring)
 * and must never be logged or returned to the client.
 */
export async function createSponsoredAccount(
  recipientPublicKey: string,
  recipientSecret: string,
): Promise<{ hash: string }> {
  const sponsor = getSponsorKeypair()
  const recipient = Keypair.fromSecret(recipientSecret)
  if (recipient.publicKey() !== recipientPublicKey) {
    throw new StellarError("recipientPublicKey does not match recipientSecret")
  }
  const USDC = getUsdcAsset()
  const server = getServer()

  const acc = await server.loadAccount(sponsor.publicKey())
  const tx = new TransactionBuilder(acc, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.beginSponsoringFutureReserves({
        sponsoredId: recipientPublicKey,
      }),
    )
    .addOperation(
      Operation.createAccount({
        destination: recipientPublicKey,
        startingBalance: "0",
      }),
    )
    .addOperation(
      Operation.changeTrust({
        asset: USDC,
        source: recipientPublicKey,
      }),
    )
    .addOperation(
      Operation.endSponsoringFutureReserves({
        source: recipientPublicKey,
      }),
    )
    .setTimeout(60)
    .build()

  tx.sign(sponsor, recipient)
  const res = await submitTransaction(tx, "createSponsoredAccount")
  return { hash: res.hash }
}

/**
 * Claimable balance with two claimants:
 *   recipient — Claimant.predicateBeforeAbsoluteTime(deadline)
 *   sponsor   — Claimant.predicateNot(same predicate)
 */
export async function createClaimableBalance(
  recipientPublicKey: string,
  amount: string,
  expiresInSeconds: number,
): Promise<{ balanceId: string; hash: string; deadline: number }> {
  const sponsor = getSponsorKeypair()
  const USDC = getUsdcAsset()
  const server = getServer()

  const deadline = Math.floor(Date.now() / 1000) + expiresInSeconds
  const before = Claimant.predicateBeforeAbsoluteTime(String(deadline))

  const claimants = [
    new Claimant(recipientPublicKey, before),
    new Claimant(sponsor.publicKey(), Claimant.predicateNot(before)),
  ]

  const acc = await server.loadAccount(sponsor.publicKey())
  const tx = new TransactionBuilder(acc, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.createClaimableBalance({
        asset: USDC,
        amount: String(amount),
        claimants,
      }),
    )
    .setTimeout(60)
    .build()

  tx.sign(sponsor)
  const res = await submitTransaction(tx, "createClaimableBalance")
  const balanceId = tx.getClaimableBalanceId(0)

  return { balanceId, hash: res.hash, deadline }
}

/**
 * CRITICAL: recipient has 0 XLM and cannot pay fees.
 * Build inner tx (recipient as source), sign with recipient, wrap in
 * fee-bump paid by sponsor. Verified approach from the spike.
 */
export async function claimBalance(
  balanceId: string,
  recipientSecret: string,
): Promise<{ hash: string }> {
  const sponsor = getSponsorKeypair()
  const recipient = Keypair.fromSecret(recipientSecret)
  const server = getServer()

  const acc = await server.loadAccount(recipient.publicKey())
  const inner = new TransactionBuilder(acc, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.claimClaimableBalance({ balanceId }))
    .setTimeout(120)
    .build()
  inner.sign(recipient)

  const bump = TransactionBuilder.buildFeeBumpTransaction(
    sponsor,
    (Number(BASE_FEE) * 2).toString(),
    inner,
    NETWORK_PASSPHRASE,
  )
  bump.sign(sponsor)

  const res = await submitTransaction(bump, "claimBalance")
  return { hash: res.hash }
}

/**
 * Non-custodial Stellar path: claim the claimable balance and immediately
 * forward USDC to the recipient's own address in the same fee-bumped tx.
 * After this, delete the hosted secret — we must not retain a key that
 * controls funds the recipient owns.
 */
export async function claimAndForward(
  balanceId: string,
  recipientSecret: string,
  destinationPublicKey: string,
  amount: string,
): Promise<{ hash: string }> {
  const sponsor = getSponsorKeypair()
  const recipient = Keypair.fromSecret(recipientSecret)
  const USDC = getUsdcAsset()
  const server = getServer()

  const acc = await server.loadAccount(recipient.publicKey())
  const inner = new TransactionBuilder(acc, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.claimClaimableBalance({ balanceId }))
    .addOperation(
      Operation.payment({
        destination: destinationPublicKey,
        asset: USDC,
        amount: String(amount),
      }),
    )
    .setTimeout(120)
    .build()
  inner.sign(recipient)

  const bump = TransactionBuilder.buildFeeBumpTransaction(
    sponsor,
    (Number(BASE_FEE) * 3).toString(),
    inner,
    NETWORK_PASSPHRASE,
  )
  bump.sign(sponsor)

  const res = await submitTransaction(bump, "claimAndForward")
  return { hash: res.hash }
}

/**
 * Sponsor claims after expiry.
 * Before the deadline Horizon returns op_cannot_claim — expected; surfaced as StellarError.
 */
export async function refundExpiredBalance(balanceId: string): Promise<{ hash: string }> {
  const sponsor = getSponsorKeypair()
  const server = getServer()

  const acc = await server.loadAccount(sponsor.publicKey())
  const tx = new TransactionBuilder(acc, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.claimClaimableBalance({ balanceId }))
    .setTimeout(60)
    .build()
  tx.sign(sponsor)

  try {
    const res = await submitTransaction(tx, "refundExpiredBalance")
    return { hash: res.hash }
  } catch (err) {
    if (err instanceof StellarError) {
      const ops = err.resultCodes?.operations ?? []
      if (ops.includes("op_cannot_claim")) {
        throw new StellarError(
          "Claimable balance cannot be claimed yet (op_cannot_claim) — deadline has not passed",
          err.resultCodes,
        )
      }
    }
    throw err
  }
}

/** Balances plus subentry_count, num_sponsoring, num_sponsored. */
export async function getAccountState(publicKey: string): Promise<AccountState> {
  const server = getServer()
  try {
    const a = await server.loadAccount(publicKey)
    return {
      publicKey,
      balances: a.balances.map((b) => ({
        asset: "asset_code" in b && b.asset_code ? b.asset_code : "XLM",
        balance: b.balance,
      })),
      subentryCount: a.subentry_count,
      numSponsoring: a.num_sponsoring ?? 0,
      numSponsored: a.num_sponsored ?? 0,
    }
  } catch (err) {
    const resultCodes = extractResultCodes(err)
    throw new StellarError(
      `Account ${publicKey} not found or unreachable`,
      resultCodes,
    )
  }
}
