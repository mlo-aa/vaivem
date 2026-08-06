# Vaivém

Walletless USDC claim links with PIX/SPEI cash-out (Etherfuse + Stellar).

## Run locally

```bash
npm install
```

**Web app** (API + dashboard + claim pages) on port 3000:

```bash
npm run dev
```

**Second app** (`apps/demo`, imports `@vaivem/react`) on port 3001 — needs the web app running for quotes:

```bash
npm run dev:demo
```

Point the demo at the host with `NEXT_PUBLIC_VAIVEM_API=http://localhost:3000` (that is the default in `apps/demo`).

## Kit usage

```tsx
"use client"
import { RampWithdraw } from "@vaivem/react"

export default function Page() {
  return (
    <RampWithdraw
      amount={50}
      country="BR"
      apiBaseUrl=""
      onPaid={({ reference }) => console.log(reference)}
    />
  )
}
```

`apiBaseUrl` must host `POST /api/quote`. Empty string uses the same origin. From `apps/demo`, use `http://localhost:3000`. Live Etherfuse sandbox quotes when `ETHERFUSE_API_KEY` is set; otherwise mock (`source: "mock"`) on provider outages (5xx). Kit KYC remains simulated.

## Env checklist (`apps/web/.env.local`)

| Variable | Required | Notes |
|----------|----------|--------|
| `AUTH_SECRET` | yes (prod) | Shared by Edge middleware and Node |
| `ETHERFUSE_API_KEY` | for live quotes | Sandbox or live |
| `ETHERFUSE_BRL_BANK_ACCOUNT_ID` | for PIX off-ramp | Org bank account |
| `ETHERFUSE_MXN_BANK_ACCOUNT_ID` | for MXN on-ramp | Optional override |
| `ETHERFUSE_CRYPTO_WALLET_ID` | optional | |
| `STELLAR_SPONSOR_SECRET` | for claims | Testnet sponsor |
| `STELLAR_USDC_ISSUER` | for claims | Etherfuse testnet USDC |
| `STELLAR_NETWORK` | optional | testnet |
| `RESEND_API_KEY`, `EMAIL_FROM` | prod login | Without them, codes log to the console in **development only** — never returned in production JSON |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | prod recommended | Claim secrets + balances; local falls back to `apps/web/.data/` / memory |
| `NEXT_PUBLIC_APP_URL` | recommended | Claim link base URL |
| `NEXT_PUBLIC_VAIVEM_API` | demo app | Defaults to `http://localhost:3000` |

See [docs/architecture.md](docs/architecture.md) for detail.

## Corridor status (sandbox)

Provider availability shifts without notice — observations in [SPIKE.md](SPIKE.md).

| Provider | Corridor | Status |
|----------|----------|--------|
| Etherfuse | BRL / PIX on-ramp (funding) | live in sandbox (≤500 BRL) — was `FailedToGetQuote` on 2026-08-05, returned 200 on 2026-08-06 |
| Etherfuse | MXN / SPEI on-ramp (funding) | live in sandbox (≤500 MXN) |
| Etherfuse | USDC → BRL / PIX off-ramp | **down** as of 2026-08-06 (`FailedToGetQuote` at every amount) |
| Etherfuse | USDC → MXN / SPEI off-ramp | live in sandbox — claim path uses claim.country `MX` |
| Mock | any | outage fallback / local testing |
| Manteca | BRL / PIX | interface only — not implemented |

**Not built:** production custody / per-user wallets, webhooks delivery, SMS verification, Google OAuth, passwords, passkeys, multi-anchor routing, org roles.
