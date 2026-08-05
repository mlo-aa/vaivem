/**
 * lib/server/claim-secrets.ts
 *
 * Recipient secrets for sponsored claimable balances.
 * NEVER expose this Map (or its values) to the client.
 *
 * TODO(persistence): replace the in-memory Map with durable encrypted storage
 * (e.g. Supabase + KMS). Secrets are lost on process restart / HMR today.
 */

import "server-only"

/** balanceId → recipient secret seed */
export const recipientSecretsByBalanceId = new Map<string, string>()
