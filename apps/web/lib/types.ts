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

export type PayoutMethod = 'stellar' | 'pix' | 'spei' | null

export type DisplayCurrency = 'BRL' | 'USD'

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
