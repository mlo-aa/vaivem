import type {
  Claim,
  ClaimEvent,
  Organization,
  User,
  Wallet,
  WalletActivity,
} from './types'
import { USD_TO_BRL } from './format'

export const currentUser: User = {
  id: 'usr_a1b2c3',
  name: 'Marina Alves',
  email: 'marina@brbuilders.io',
  role: 'owner',
  organizationId: 'org_brbuilders',
  createdAt: '2025-11-02T10:00:00.000Z',
}

export const currentOrg: Organization = {
  id: 'org_brbuilders',
  name: 'Brazil Builders Hackathon',
  logo: null,
  country: 'BR',
  balance: 12480.55,
  defaultAsset: 'USDC',
  branding: {
    accentColor: '#1fbf75',
    recipientMessage: 'Thank you for participating. Here is your reward.',
    supportEmail: 'support@brbuilders.io',
  },
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString()
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString()
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3600000).toISOString()
}

function usdcToDisplay(usdc: number, currency: 'BRL' | 'USD'): number {
  return currency === 'BRL' ? Math.round(usdc * USD_TO_BRL * 100) / 100 : usdc
}

export const claims: Claim[] = [
  {
    id: 'clm_8F2K9A',
    token: '8F2K9A',
    senderId: currentUser.id,
    organizationId: currentOrg.id,
    recipientName: 'Lucas Ferreira',
    recipientEmail: 'lucas.ferreira@example.com',
    recipientCountry: 'BR',
    amount: 99.1,
    displayCurrency: 'BRL',
    displayAmount: 500,
    asset: 'USDC',
    status: 'completed',
    protectionType: 'email',
    expiresAt: daysFromNow(4),
    createdAt: daysAgo(2),
    claimedAt: daysAgo(1),
    payoutMethod: 'pix',
    message: 'Congratulations on winning first place at the hackathon!',
    purpose: 'Hackathon prize',
    reference: 'HACK-2025-1ST',
    stellarTransactionHash: 'a7f3c9e21b8d45f6a0c1e2d3b4a5968770f1e2d3c4b5a6978890a1b2c3d4e5f6',
    withdrawalReference: 'pix_9K2L4M',
  },
  {
    id: 'clm_3H7L2B',
    token: '3H7L2B',
    senderId: currentUser.id,
    organizationId: currentOrg.id,
    recipientName: 'Sofia Rodrigues',
    recipientEmail: 'sofia.r@example.com',
    recipientCountry: 'BR',
    amount: 59.46,
    displayCurrency: 'BRL',
    displayAmount: 300,
    asset: 'USDC',
    status: 'claimed',
    protectionType: 'email',
    expiresAt: daysFromNow(6),
    createdAt: daysAgo(1),
    claimedAt: hoursFromNow(-3),
    payoutMethod: 'stellar',
    message: 'Second place — amazing work this weekend.',
    purpose: 'Hackathon prize',
    reference: 'HACK-2025-2ND',
    stellarTransactionHash: 'b8e4d0f32c9e56a7b1d2e3f4c5b6079881a2b3c4d5e6f7089901b2c3d4e5f607',
    withdrawalReference: null,
  },
  {
    id: 'clm_9M4N1C',
    token: '9M4N1C',
    senderId: currentUser.id,
    organizationId: currentOrg.id,
    recipientName: 'Gabriel Santos',
    recipientEmail: 'gabriel.santos@example.com',
    recipientCountry: 'BR',
    amount: 39.64,
    displayCurrency: 'BRL',
    displayAmount: 200,
    asset: 'USDC',
    status: 'viewed',
    protectionType: 'code',
    expiresAt: daysFromNow(2),
    createdAt: daysAgo(1),
    claimedAt: null,
    payoutMethod: null,
    message: 'Third place. Keep building!',
    purpose: 'Hackathon prize',
    reference: 'HACK-2025-3RD',
    stellarTransactionHash: 'c9f5e1043daf67b8c2e3f4059d6e7182992b3c4d5e6f70899012c3d4e5f60718',
    withdrawalReference: null,
  },
  {
    id: 'clm_5P8Q3D',
    token: '5P8Q3D',
    senderId: currentUser.id,
    organizationId: currentOrg.id,
    recipientName: 'Isabela Costa',
    recipientEmail: 'isabela.costa@example.com',
    recipientCountry: 'BR',
    amount: 148.65,
    displayCurrency: 'BRL',
    displayAmount: 750,
    asset: 'USDC',
    status: 'shared',
    protectionType: 'email',
    expiresAt: daysFromNow(7),
    createdAt: daysAgo(0.4),
    claimedAt: null,
    payoutMethod: null,
    message: 'Best design award — congrats!',
    purpose: 'Community reward',
    reference: 'DESIGN-AWARD',
    stellarTransactionHash: 'd0061f254ebf78c9d3f405160e7f8293003c4d5e6f708990123d4e5f60718293',
    withdrawalReference: null,
  },
  {
    id: 'clm_2R6S7E',
    token: '2R6S7E',
    senderId: currentUser.id,
    organizationId: currentOrg.id,
    recipientName: 'Pedro Oliveira',
    recipientEmail: 'pedro.o@example.com',
    recipientCountry: 'BR',
    amount: 79.28,
    displayCurrency: 'BRL',
    displayAmount: 400,
    asset: 'USDC',
    status: 'cashing_out',
    protectionType: 'public',
    expiresAt: daysFromNow(1),
    createdAt: daysAgo(3),
    claimedAt: hoursFromNow(-6),
    payoutMethod: 'pix',
    message: 'Freelance milestone payment.',
    purpose: 'Freelancer payment',
    reference: 'INV-0421',
    stellarTransactionHash: 'e1172035fcf089d0e405162738090304114d5e6f7089901234e5f6071829304a',
    withdrawalReference: 'pix_3F5G7H',
  },
  {
    id: 'clm_7T1U9F',
    token: '7T1U9F',
    senderId: currentUser.id,
    organizationId: currentOrg.id,
    recipientName: 'Camila Souza',
    recipientEmail: 'camila.souza@example.com',
    recipientCountry: 'BR',
    amount: 29.73,
    displayCurrency: 'BRL',
    displayAmount: 150,
    asset: 'USDC',
    status: 'expired',
    protectionType: 'email',
    expiresAt: daysAgo(1),
    createdAt: daysAgo(8),
    claimedAt: null,
    payoutMethod: null,
    message: 'Event participation incentive.',
    purpose: 'Event incentive',
    reference: 'EVENT-SP-02',
    stellarTransactionHash: 'f2283146adf190e1f516273849101405225e6f708990123456f60718293040ab',
    withdrawalReference: null,
  },
  {
    id: 'clm_4V3W2G',
    token: '4V3W2G',
    senderId: currentUser.id,
    organizationId: currentOrg.id,
    recipientName: 'Rafael Lima',
    recipientEmail: 'rafael.lima@example.com',
    recipientCountry: 'BR',
    amount: 198.2,
    displayCurrency: 'BRL',
    displayAmount: 1000,
    asset: 'USDC',
    status: 'refunded',
    protectionType: 'code',
    expiresAt: daysAgo(3),
    createdAt: daysAgo(12),
    claimedAt: null,
    payoutMethod: null,
    message: 'Grant disbursement — Q4 cohort.',
    purpose: 'Grant',
    reference: 'GRANT-Q4-11',
    stellarTransactionHash: '03394257bef201f206172738495101516336f708990123456701829304150abc',
    withdrawalReference: null,
  },
  {
    id: 'clm_6X5Y8H',
    token: '6X5Y8H',
    senderId: currentUser.id,
    organizationId: currentOrg.id,
    recipientName: 'Beatriz Almeida',
    recipientEmail: 'bia.almeida@example.com',
    recipientCountry: 'BR',
    amount: 49.55,
    displayCurrency: 'BRL',
    displayAmount: 250,
    asset: 'USDC',
    status: 'funded',
    protectionType: 'email',
    expiresAt: daysFromNow(3),
    createdAt: daysAgo(0.1),
    claimedAt: null,
    payoutMethod: null,
    message: 'Refund for cancelled workshop ticket.',
    purpose: 'Refund',
    reference: 'REF-WS-88',
    stellarTransactionHash: '14405368cff312030718293040516172447f7089901234567018293041526bcd',
    withdrawalReference: null,
  },
]

export const claimEvents: Record<string, ClaimEvent[]> = {
  clm_8F2K9A: [
    { id: 'ev1', claimId: 'clm_8F2K9A', event: 'created', timestamp: daysAgo(2) },
    { id: 'ev2', claimId: 'clm_8F2K9A', event: 'funds_locked', timestamp: daysAgo(2) },
    { id: 'ev3', claimId: 'clm_8F2K9A', event: 'shared', timestamp: daysAgo(2) },
    { id: 'ev4', claimId: 'clm_8F2K9A', event: 'opened', timestamp: daysAgo(1.6) },
    { id: 'ev5', claimId: 'clm_8F2K9A', event: 'verified', timestamp: daysAgo(1.5) },
    { id: 'ev6', claimId: 'clm_8F2K9A', event: 'claimed', timestamp: daysAgo(1.4) },
    { id: 'ev7', claimId: 'clm_8F2K9A', event: 'pix_initiated', timestamp: daysAgo(1.4) },
    { id: 'ev8', claimId: 'clm_8F2K9A', event: 'pix_completed', timestamp: daysAgo(1.39) },
  ],
}

export const wallet: Wallet = {
  id: 'wal_z9y8x7',
  userId: 'usr_recipient_1',
  stellarAddress: 'GБ...', // replaced below to avoid non-ascii
  usdcBalance: 99.1,
  sponsored: true,
  createdAt: daysAgo(1),
}
wallet.stellarAddress = 'GBRZ7K4M9QW2XN5PLVJH8YT3DC6FA0EUS1IGBNOX4WLQ2MZK9RTVUPYD'

export const walletActivity: WalletActivity[] = [
  {
    id: 'wa1',
    type: 'claim',
    label: 'Claimed prize · Brazil Builders Hackathon',
    amount: 99.1,
    displayAmount: 500,
    timestamp: daysAgo(1),
  },
  {
    id: 'wa2',
    type: 'received',
    label: 'Received USDC · Community reward',
    amount: 20,
    displayAmount: 100.9,
    timestamp: daysAgo(4),
  },
  {
    id: 'wa3',
    type: 'sent',
    label: 'Sent USDC · to a friend',
    amount: -15,
    displayAmount: -75.68,
    timestamp: daysAgo(6),
  },
  {
    id: 'wa4',
    type: 'refund',
    label: 'Received refund · Workshop ticket',
    amount: 12.5,
    displayAmount: 63.06,
    timestamp: daysAgo(9),
  },
]

// Payout activity for the dashboard chart (last 14 days).
export const payoutActivity = Array.from({ length: 14 }).map((_, i) => {
  const date = new Date(Date.now() - (13 - i) * 86400000)
  const base = 200 + Math.sin(i / 2) * 140 + i * 22
  const claimed = Math.max(0, base - 60 + (i % 3) * 40)
  return {
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sent: Math.round(base),
    claimed: Math.round(claimed),
  }
})
