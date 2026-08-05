# Spike findings

Verified against Etherfuse sandbox and Stellar testnet. Source scripts: `spike/spike.mjs`, `apps/web/lib/server/etherfuse.ts`, `apps/web/lib/server/stellar.ts`.

## Etherfuse

- `GET /ramp/assets` requires all three query params: `blockchain`, `currency`, and `wallet`. Omitting any returns a deserialize/missing-field error.
- `Authorization` is the raw API key string. A `Bearer ` prefix is rejected.
- Quotes expire in exactly 120 seconds (`expiresAt` = `createdAt` + 2 minutes).
- `feeAmount` is denominated in the **source** asset (USDC), not in fiat (BRL/MXN).
- Reference quote measured in sandbox: **50 USDC → 256.59677 BRL**, mid-market rate **5.13193556**, fee **20 bps**.
- **Minimum amount is 1 USDC.** Below roughly that, `POST /ramp/quote` returns HTTP **424**. Behaviour in the 0.4–0.5 range is inconsistent: 0.42 and 0.50 succeeded, while 0.39, 0.45 and 0.48 failed repeatably. 1 USDC is treated as the supported floor (`MIN_AMOUNT_USDC` in `apps/web/lib/limits.ts` and `@vaivem/react`).
- The mock fallback is for **provider outages only** (5xx, timeout, network). A 4xx is returned to the client with the upstream status, because the provider is up and the request is what is wrong — reporting it as "live provider unavailable" would be false.
- In `/api/payouts/pix` the fallback is additionally scoped **by phase**: config and quote may degrade to a mock (nothing has moved yet), while an order or anchor-payment failure is always reported. A 200 after a failed payment shows "Money on the way!" to someone who received nothing.

## Stellar (testnet)

Horizon: `https://horizon-testnet.stellar.org`, network passphrase `Networks.TESTNET`.

- Sponsored account creation in one transaction: `beginSponsoringFutureReserves` → `createAccount` with `startingBalance: "0"` → `changeTrust(USDC)` (source: recipient) → `endSponsoringFutureReserves` (source: recipient). Signed by sponsor and recipient.
- After that, the recipient account shows **XLM 0.0000000** and **sponsored: 3** (account + trustline reserves covered by the sponsor).
- Claim of a claimable balance by a 0-XLM recipient succeeds when the inner `claimClaimableBalance` tx is wrapped in a **fee-bump** paid by the sponsor.
- Sponsor refund (`claimClaimableBalance` as sponsor) before the absolute-time deadline fails with **`op_cannot_claim`**. The same operation succeeds after the deadline.
- Submission failures are classified from the Horizon result codes by `describeStellarFailure` (`apps/web/lib/server/stellar.ts`): `op_underfunded` (sponsor is out of Etherfuse-issued USDC), `op_no_trust`, `op_no_destination`, `tx_bad_seq`, `tx_too_late`. Anything else is reported with the raw Horizon detail rather than swallowed.
