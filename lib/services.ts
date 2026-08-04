import type {
  BatchRecipient,
  Claim,
  DisplayCurrency,
  PixPayout,
  Quote,
  Wallet,
} from './types'
import { claims as seedClaims, currentOrg, currentUser } from './mock-data'
import {
  NETWORK_FEE_USDC,
  PROVIDER_FEE_PCT,
  USD_TO_BRL,
} from './format'
import {
  authAdapter,
  mantecaAdapter,
  randomStellarAddress,
  randomToken,
  randomTxHash,
  stellarAdapter,
} from './adapters'

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

// Returns a live-style quote converting a display amount to USDC (or vice versa).
export async function getQuote(
  amount: number,
  displayCurrency: DisplayCurrency,
): Promise<Quote> {
  await delay(500)
  // TODO(manteca/etherfuse): fetch a real FX quote here.
  const jitter = 1 + (Math.random() - 0.5) * 0.004
  const rate = displayCurrency === 'BRL' ? USD_TO_BRL * jitter : 1
  const usdc =
    displayCurrency === 'BRL'
      ? Math.round((amount / rate) * 100) / 100
      : amount
  const providerFee = Math.round(usdc * PROVIDER_FEE_PCT * 100) / 100
  return {
    sourceAmount: amount,
    sourceCurrency: displayCurrency,
    destinationAmount: usdc,
    destinationCurrency: 'USDC',
    exchangeRate: Math.round(rate * 1000) / 1000,
    providerFee,
    networkFee: NETWORK_FEE_USDC,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  }
}

export async function getPixQuote(usdc: number): Promise<Quote> {
  await delay(600)
  const { rate, fee, brl } = await mantecaAdapter.getPixQuote(usdc)
  return {
    sourceAmount: usdc,
    sourceCurrency: 'USDC',
    destinationAmount: brl,
    destinationCurrency: 'BRL',
    exchangeRate: rate,
    providerFee: fee,
    networkFee: 0,
    expiresAt: new Date(Date.now() + 90_000).toISOString(),
  }
}

// --- Claims ----------------------------------------------------------------

export async function createClaim(input: CreateClaimInput): Promise<Claim> {
  await delay(700)
  const token = randomToken()
  const quote = await getQuote(input.amount, input.displayCurrency)
  const claim: Claim = {
    id: `clm_${token}`,
    token,
    senderId: currentUser.id,
    organizationId: currentOrg.id,
    recipientName: input.recipientName,
    recipientEmail: input.recipientEmail ?? null,
    recipientCountry: input.recipientCountry,
    amount: quote.destinationAmount,
    displayCurrency: input.displayCurrency,
    displayAmount: input.amount,
    asset: 'USDC',
    status: 'draft',
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
  const { reference } = await mantecaAdapter.createPixOrder()
  return {
    id: `pxo_${randomToken().toLowerCase()}`,
    claimId: 'clm_demo',
    cpf: input.cpf,
    pixKeyType: input.pixKeyType,
    maskedPixKey: input.pixKey,
    amountBRL: quote.destinationAmount,
    amountUSDC: input.amountUSDC,
    exchangeRate: quote.exchangeRate,
    fee: quote.providerFee,
    status: 'completed',
    provider: 'Manteca',
    reference,
    createdAt: new Date().toISOString(),
  }
}

export async function getWithdrawalStatus(): Promise<PixPayout['status']> {
  await delay(400)
  return 'completed'
}

// --- Batch -----------------------------------------------------------------

export async function createBatchClaims(
  recipients: BatchRecipient[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ token: string; recipient: string; amount: string }[]> {
  const results: { token: string; recipient: string; amount: string }[] = []
  for (let i = 0; i < recipients.length; i++) {
    await delay(250)
    const token = randomToken()
    results.push({
      token,
      recipient: recipients[i].recipient_name,
      amount: recipients[i].amount,
    })
    onProgress?.(i + 1, recipients.length)
  }
  return results
}

// Exposed for the developer playground so mocked responses feel real.
export function mockApiResponse(amount: string) {
  const token = randomToken()
  return {
    id: `clm_${token}`,
    token,
    status: 'funded',
    amount: { asset: 'USDC', value: amount },
    claimUrl: `https://claimlink.app/br/${token}`,
    stellarTransactionHash: randomTxHash(),
    createdAt: new Date().toISOString(),
  }
}
