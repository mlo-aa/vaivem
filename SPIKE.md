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

### BRL off-ramp (USDC → PIX)

- **2026-08-06:** `POST /ramp/quote` with `type: "offramp"`, `targetAsset: "BRL"` returned HTTP **424** `FailedToGetQuote` for every amount tested (≥1 USDC). MXN off-ramp quotes on the same org still returned 200. Product claim PIX path must not consume the Stellar claimable balance until a quote+order succeeds.

### BRL on-ramp (fiat → USDC, funding)

- **2026-08-05:** `POST /ramp/quote` with `type: "onramp"`, `sourceAsset: "BRL"`, `targetAsset: USDC:GBBD47…` returned HTTP **424** `FailedToGetQuote` for every amount tested on our sandbox org. The app correctly blocked BRL funding with an explicit message rather than failing silently.
- **2026-08-06:** The same path started returning HTTP **200**. Example: 100 BRL → ~19.48 USDC quoted, `feeBps` 20, 120s TTL. Provider capability can change without notice — the kit and server adapters should treat corridor availability as runtime data, not hardcoded product truth.
- **Sandbox fiat cap:** Both **BRL and MXN** on-ramps reject amounts above **500** with `SandboxAmountExceeded` (501 fails; 500 succeeds).
- **`POST /ramp/order` (BRL, observed 2026-08-06):** Same top-level shape as MXN — `{ onramp: { orderId, depositClabe, depositAmount, depositBankName, depositAccountHolder } }`. For BRL, `depositClabe` is empty, `depositBankName` is `"PIX"`, `depositAmount` is the BRL amount. No separate copia-e-cola field in the POST body; sandbox payment uses `statusPage` from `GET /ramp/order/{id}` (e.g. `https://sandbox.etherfuse.com/ramp/order/{orderId}`). If Etherfuse adds Pix payload fields later, pass them through rather than assuming names.
- **`statusPage` UI (BRL, sandbox, verified 2026-08-06):** Client-rendered order page — order summary, amount in BRL, **Get Transfer Details** button. That modal currently shows SPEI-style copy with an **empty CLABE** and the BRL amount; **no Pix copia-e-cola and no payable Pix QR** on the page. Public `GET /ramping/order/{id}/update` also has `stpProxyClabe: null`. Do not label a QR of the `statusPage` URL as a bank Pix code — it is only a link to this page.

## Stellar (testnet)

Horizon: `https://horizon-testnet.stellar.org`, network passphrase `Networks.TESTNET`.

- Sponsored account creation in one transaction: `beginSponsoringFutureReserves` → `createAccount` with `startingBalance: "0"` → `changeTrust(USDC)` (source: recipient) → `endSponsoringFutureReserves` (source: recipient). Signed by sponsor and recipient.
- After that, the recipient account shows **XLM 0.0000000** and **sponsored: 3** (account + trustline reserves covered by the sponsor).
- Claim of a claimable balance by a 0-XLM recipient succeeds when the inner `claimClaimableBalance` tx is wrapped in a **fee-bump** paid by the sponsor.
- Sponsor refund (`claimClaimableBalance` as sponsor) before the absolute-time deadline fails with **`op_cannot_claim`**. The same operation succeeds after the deadline.
- Submission failures are classified from the Horizon result codes by `describeStellarFailure` (`apps/web/lib/server/stellar.ts`): `op_underfunded` (sponsor is out of Etherfuse-issued USDC), `op_no_trust`, `op_no_destination`, `tx_bad_seq`, `tx_too_late`. Anything else is reported with the raw Horizon detail rather than swallowed.
