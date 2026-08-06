/**
 * Reconcile cashing_out claims against the live Etherfuse order status.
 */

import "server-only"

import { getOrder } from "@/lib/server/etherfuse"
import {
  type StoredClaim,
  updateStoredClaim,
} from "@/lib/server/claim-store"
import { recipientSecretsByBalanceId } from "@/lib/server/claim-secrets"

/**
 * If the claim is cashing_out and has a payoutOrderId, fetch the order and
 * persist completed / failed. No-op for every other status.
 */
export async function reconcileClaimPayout(
  claim: StoredClaim,
): Promise<StoredClaim> {
  if (claim.status !== "cashing_out" || !claim.payoutOrderId) {
    return claim
  }

  try {
    const order = await getOrder(claim.payoutOrderId)
    const status = String(order.status ?? "").toLowerCase()

    if (status === "completed") {
      await recipientSecretsByBalanceId.delete(claim.balanceId)
      const updated = await updateStoredClaim(claim.token, {
        status: "completed",
        claimedAt: claim.claimedAt ?? new Date().toISOString(),
        payoutMethod: claim.payoutMethod ?? "pix",
      })
      return updated ?? claim
    }

    if (status === "failed") {
      const updated = await updateStoredClaim(claim.token, {
        // Funds left escrow already — surface as failed completion path.
        // Keep cashing_out cleared so the dashboard does not spin forever.
        status: "cancelled",
      })
      return updated ?? claim
    }

    return claim
  } catch (err) {
    console.error(
      `[reconcile] order ${claim.payoutOrderId} for ${claim.token}:`,
      err instanceof Error ? err.message : err,
    )
    return claim
  }
}
