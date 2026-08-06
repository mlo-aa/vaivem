// Core domain types for Vaivém.
// These mirror the eventual database schema (Supabase-ready) so the UI never
// needs to change when real Stellar / PIX / auth adapters are wired in.

export type ClaimStatus =
  | 'draft'
  | 'funded'
  | 'shared'
  | 'viewed'
  | 'claimed'
  | 'cashing_out'
  | 'completed'
  | 'expired'
  | 'refunded'
  | 'cancelled'

export type ProtectionType = 'public' | 'email' | 'code'

export type PayoutMethod = 'stellar' | 'pix' | null

export type DisplayCurrency = 'BRL' | 'USD'

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random'

export type KycStatus = 'not_started' | 'pending' | 'approved' | 'rejected'

export type ClaimEventType =
  | 'created'
  | 'funds_locked'
  | 'shared'
  | 'opened'
  | 'verified'
  | 'claimed'
  | 'pix_initiated'
  | 'pix_completed'
  | 'wallet_created'
  | 'cancelled'
  | 'refunded'
  | 'expired'

export interface User {
  id: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'member'
  organizationId: string
  createdAt: string
}

export interface Organization {
  id: string
  name: string
  logo: string | null
  country: string
  balance: number // USDC available balance
  defaultAsset: 'USDC'
  branding: {
    accentColor: string
    recipientMessage: string
    supportEmail: string
  }
}

export interface Claim {
  id: string
  token: string
  senderId: string
  organizationId: string
  recipientName: string
  recipientEmail: string | null
  recipientCountry: string
  amount: number // amount in USDC
  displayCurrency: DisplayCurrency
  displayAmount: number // amount in display currency (BRL/USD)
  asset: 'USDC'
  status: ClaimStatus
  kycStatus?: KycStatus
  protectionType: ProtectionType
  expiresAt: string
  createdAt: string
  claimedAt: string | null
  payoutMethod: PayoutMethod
  message: string | null
  purpose: string
  reference: string | null
  stellarTransactionHash: string | null
  withdrawalReference: string | null
  /** Present when created via CSV batch upload. */
  batchId?: string | null
}

export interface ClaimEvent {
  id: string
  claimId: string
  event: ClaimEventType
  timestamp: string
  metadata?: Record<string, string>
}

export interface Quote {
  quoteId: string
  sourceAmount: string
  destinationAmount: string
  exchangeRate: string // post-fee rate actually applied
  etherfuseMidMarketRate: string
  nominalRate: string
  feeBps: string
  feeAmount: string // denominated in the SOURCE asset (USDC), not fiat
  requiresSwap: boolean
  createdAt: string
  expiresAt: string // exactly 2 minutes after createdAt
  currency: string
  source: "live" | "mock"
  note?: string
}

export interface Wallet {
  id: string
  userId: string
  stellarAddress: string
  usdcBalance: number
  sponsored: boolean
  createdAt: string
}

export interface PixPayout {
  id: string
  claimId: string
  cpf: string
  pixKeyType: PixKeyType
  maskedPixKey: string
  amountBRL: number
  amountUSDC: number
  exchangeRate: number
  fee: number
  status: 'pending' | 'converting' | 'sending' | 'completed' | 'failed'
  provider: string
  reference: string
  createdAt: string
}

export interface WalletActivity {
  id: string
  type: 'claim' | 'withdrawal' | 'refund' | 'sent' | 'received'
  label: string
  amount: number // USDC, negative for outgoing
  displayAmount: number // BRL equivalent
  timestamp: string
}


