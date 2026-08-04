import type {
  Claim,
  DisplayCurrency,
  KycStatus,
  PixPayout,
  Quote,
  Wallet,
} from './types'
import { claims as seedClaims, currentOrg, currentUser } from './mock-data'
import { USD_TO_BRL } from './format'
import {
  authAdapter,
  etherfuseAdapter,
  randomStellarAddress,
  randomToken,
  randomTxHash,
  stellarAdapter,
} from './adapters'

// Quote lifetime enforced by Etherfuse: exactly 2 minutes.
export const QUOTE_TTL_MS = 120_000

// Simulated network latency so loading states are exercised in the demo.
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface CreateClaimInput {
  amount: number
  displayCurrency: DisplayCurrency
  recipientCountry: string
  purpose: string
  reference?: string
  message?: string
  protectionType: 'public' | 'email' | 'code'
  recipientName: string
  recipientEmail?: string
  recipientPhone?: string
  accessCode?: string
  expirationDays: number
  allowStellar: boolean
  allowPix: boolean
}

// --- Quoting ---------------------------------------------------------------

// Convert a sender's display amount (BRL or USD) into the USDC to lock.
// Used by the create flow; returns a plain number since it isn't a settlement.
export async function getFundingUsdc(
  amount: number,
  displayCurrency: DisplayCurrency,
): Promise<number> {
  await delay(400)
  const rate = displayCurrency === 'BRL' ? USD_TO_BRL : 1
  const usdc = displayCurrency === 'BRL' ? amount / rate : amount
  return Math.round(usdc * 100) / 100
}

// Etherfuse USDC -> BRL settlement quote. All monetary values are strings and
// the provider fee is denominated in USDC (the source asset). Valid 2 minutes.
export async function getPixQuote(usdc: number): Promise<Quote> {
  await delay(600)
  const q = await etherfuseAdapter.getQuote(usdc)
  const createdAt = new Date()
  const expiresAt = new Date(createdAt.getTime() + QUOTE_TTL_MS)
  const feeAmount = Number(q.feeAmountUsdc)
  const netUsdc = usdc - feeAmount
  const brl = netUsdc * Number(q.effectiveRate)
  return {
    quoteId: q.quoteId,
    sourceAmount: usdc.toFixed(6),
    destinationAmount: brl.toFixed(2),
    exchangeRate: q.effectiveRate,
    etherfuseMidMarketRate: q.midMarketRate,
    nominalRate: q.nominalRate,
    feeBps: q.feeBps,
    feeAmount: q.feeAmountUsdc,
    requiresSwap: q.requiresSwap,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  }
}

// --- Claims ----------------------------------------------------------------

export async function createClaim(input: CreateClaimInput): Promise<Claim> {
  await delay(700)
  const token = randomToken()
  const usdc = await getFundingUsdc(input.amount, input.displayCurrency)
  const claim: Claim = {
    id: `clm_${token}`,
    token,
    senderId: currentUser.id,
    organizationId: currentOrg.id,
    recipientName: input.recipientName,
    recipientEmail: input.recipientEmail ?? null,
    recipientCountry: input.recipientCountry,
    amount: usdc,
    displayCurrency: input.displayCurrency,
    displayAmount: input.amount,
    asset: 'USDC',
    status: 'draft',
    kycStatus: 'not_started',
    protectionType: input.protectionType,
    expiresAt: new Date(Date.now() + input.expirationDays * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    claimedAt: null,
    payoutMethod: null,
    message: input.message ?? null,
    purpose: input.purpose,
    reference: input.reference ?? null,
    stellarTransactionHash: null,
    withdrawalReference: null,
  }
  return claim
}

// Simulate funding a claim on Stellar. Emits progress via a callback.
export async function fundClaim(
  claim: Claim,
  onStep?: (step: number) => void,
): Promise<Claim> {
  const steps = 4
  for (let i = 1; i <= steps; i++) {
    await delay(800)
    onStep?.(i)
  }
  const { hash } = await stellarAdapter.lockFunds()
  return { ...claim, status: 'funded', stellarTransactionHash: hash }
}

export async function getClaim(token: string): Promise<Claim | null> {
  await delay(500)
  const found = seedClaims.find((c) => c.token.toLowerCase() === token.toLowerCase())
  return found ?? null
}

export async function cancelClaim(claim: Claim): Promise<Claim> {
  await delay(600)
  return { ...claim, status: 'cancelled' }
}

export async function refundClaim(claim: Claim): Promise<Claim> {
  await delay(700)
  const { hash } = await stellarAdapter.sendPayment()
  return { ...claim, status: 'refunded', stellarTransactionHash: hash }
}

export async function extendExpiration(claim: Claim, days: number): Promise<Claim> {
  await delay(500)
  return { ...claim, expiresAt: new Date(Date.now() + days * 86400000).toISOString() }
}

// --- Recipient verification ------------------------------------------------

export async function sendVerificationCode(): Promise<{ sent: true }> {
  await delay(700)
  // TODO(auth): trigger a real one-time code via email/SMS provider.
  return { sent: true }
}

export async function verifyRecipient(code: string): Promise<{ ok: boolean }> {
  await delay(700)
  return authAdapter.verifyOtp(code)
}

// --- KYC (required before a PIX cash-out) ----------------------------------

export interface KycInput {
  fullName: string
  taxId: string // CPF or CNPJ
  dateOfBirth: string
}

// Etherfuse requires an approved KYC record before settling to a bank/PIX key.
// The mock approves any well-formed CPF/CNPJ and rejects the reserved all-zero id.
export async function submitKyc(
  input: KycInput,
  onStep?: (step: number) => void,
): Promise<{ status: KycStatus }> {
  const steps = 3
  for (let i = 1; i <= steps; i++) {
    await delay(700)
    onStep?.(i)
  }
  const digits = input.taxId.replace(/\D/g, '')
  const valid = (digits.length === 11 || digits.length === 14) && !/^0+$/.test(digits)
  return { status: valid ? 'approved' : 'rejected' }
}

// --- Wallet ----------------------------------------------------------------

export async function createEmbeddedWallet(
  onStep?: (step: number) => void,
): Promise<Wallet> {
  const steps = 4
  for (let i = 1; i <= steps; i++) {
    await delay(750)
    onStep?.(i)
  }
  const { address } = await stellarAdapter.createSponsoredAccount()
  return {
    id: `wal_${randomToken().toLowerCase()}`,
    userId: 'usr_recipient',
    stellarAddress: address || randomStellarAddress(),
    usdcBalance: 0,
    sponsored: true,
    createdAt: new Date().toISOString(),
  }
}

export async function claimToWallet(wallet: Wallet, amount: number): Promise<Wallet> {
  await delay(800)
  const { hash } = await stellarAdapter.sendPayment()
  void hash
  return { ...wallet, usdcBalance: wallet.usdcBalance + amount }
}

// --- PIX withdrawal --------------------------------------------------------

export interface PixWithdrawalInput {
  fullName: string
  cpf: string
  pixKeyType: PixPayout['pixKeyType']
  pixKey: string
  amountUSDC: number
}

export async function initiatePixWithdrawal(
  input: PixWithdrawalInput,
  quote: Quote,
  onStep?: (step: number) => void,
): Promise<PixPayout> {
  const steps = 4
  for (let i = 1; i <= steps; i++) {
    await delay(850)
    onStep?.(i)
  }
  const { reference } = await etherfuseAdapter.createPixOrder()
  return {
    id: `pxo_${randomToken().toLowerCase()}`,
    claimId: 'clm_demo',
    cpf: input.cpf,
    pixKeyType: input.pixKeyType,
    maskedPixKey: input.pixKey,
    amountBRL: Number(quote.destinationAmount),
    amountUSDC: input.amountUSDC,
    exchangeRate: Number(quote.exchangeRate),
    fee: Number(quote.feeAmount),
    status: 'completed',
    provider: 'Etherfuse',
    reference,
    createdAt: new Date().toISOString(),
  }
}

export async function getWithdrawalStatus(): Promise<PixPayout['status']> {
  await delay(400)
  return 'completed'
}

// Exposed for the developer playground so mocked responses feel real.
export function mockApiResponse(amount: string) {
  const token = randomToken()
  return {
    id: `clm_${token}`,
    token,
    status: 'funded',
    amount: { asset: 'USDC', value: amount },
    claimUrl: `https://vaivem.app/br/${token}`,
    stellarTransactionHash: randomTxHash(),
    createdAt: new Date().toISOString(),
  }
}
