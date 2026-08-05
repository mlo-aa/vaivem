# Spike findings

Verified against Etherfuse sandbox and Stellar testnet. Source scripts: `spike/spike.mjs`, `apps/web/lib/server/etherfuse.ts`, `apps/web/lib/server/stellar.ts`.

## Etherfuse

- `GET /ramp/assets` requires all three query params: `blockchain`, `currency`, and `wallet`. Omitting any returns a deserialize/missing-field error.
- `Authorization` is the raw API key string. A `Bearer ` prefix is rejected.
- Quotes expire in exactly 120 seconds (`expiresAt` = `createdAt` + 2 minutes).
- `feeAmount` is denominated in the **source** asset (USDC), not in fiat (BRL/MXN).
- Reference quote measured in sandbox: **50 USDC → 256.59677 BRL**, mid-market rate **5.13193556**, fee **20 bps**.

## Stellar (testnet)

Horizon: `https://horizon-testnet.stellar.org`, network passphrase `Networks.TESTNET`.

- Sponsored account creation in one transaction: `beginSponsoringFutureReserves` → `createAccount` with `startingBalance: "0"` → `changeTrust(USDC)` (source: recipient) → `endSponsoringFutureReserves` (source: recipient). Signed by sponsor and recipient.
- After that, the recipient account shows **XLM 0.0000000** and **sponsored: 3** (account + trustline reserves covered by the sponsor).
- Claim of a claimable balance by a 0-XLM recipient succeeds when the inner `claimClaimableBalance` tx is wrapped in a **fee-bump** paid by the sponsor.
- Sponsor refund (`claimClaimableBalance` as sponsor) before the absolute-time deadline fails with **`op_cannot_claim`**. The same operation succeeds after the deadline.
