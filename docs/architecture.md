# Architecture

`packages/vaivem-react` is the importable UI (`RampWithdraw`, `ClaimLink`, `useQuote`). `apps/web` hosts product pages and API routes (`/api/quote`, `/api/claims/*`, `/api/funding/*`, `/api/v1/*`). `apps/demo` imports the package and points `apiBaseUrl` at `apps/web` (`NEXT_PUBLIC_VAIVEM_API`, default `http://localhost:3000`). Provider HTTP (Etherfuse, Stellar Horizon) runs only in `apps/web/lib/server/` and route handlers. The API key never reaches the browser.

## Auth

Senders sign in with a 6-digit email code. `POST /api/auth/request-code` stores `auth-code:{email}` in KV (10-minute TTL, rate-limited); `POST /api/auth/verify-code` creates or loads `user:{email}` and sets an httpOnly signed session cookie. No passwords. Resend (`RESEND_API_KEY`, `EMAIL_FROM`) sends mail; if unset, the code is logged and returned as `{ devMode: true }`. Claims are scoped by `ownerId`. Recipient routes stay public.

## Public API

Machine callers use Bearer API keys (`sk_test_…` / `sk_live_…`) from **Dashboard → API keys**:

- `POST /api/v1/claims` — create and fund (amount is USDC)
- `GET /api/v1/claims/{id}` — read by token or `clm_{token}`

Batch and webhooks endpoints are documented as coming soon.

## Funding (demo ledger)

`/dashboard/funding` creates Etherfuse on-ramps (sandbox: BRL and MXN → USDC, max **500** fiat). Completed orders credit `balance:{ownerId}`. Creating a claim debits that balance. **Not custody segregation:** the shared Stellar sponsor wallet holds the real USDC.

USDC crypto deposits use the sponsor address with `Memo.hash(sha256(ownerId))` for attribution.

## Env (`apps/web`)

| Variable | Notes |
|----------|--------|
| `AUTH_SECRET` | Required in production; set in `.env.local` so Edge middleware and Node share the same key |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional; omit for console/devMode codes |
| `ETHERFUSE_API_KEY` | Sandbox/live Etherfuse |
| `ETHERFUSE_BRL_BANK_ACCOUNT_ID`, `ETHERFUSE_MXN_BANK_ACCOUNT_ID`, `ETHERFUSE_CRYPTO_WALLET_ID` | Optional overrides |
| Stellar sponsor vars | As used by `lib/server/stellar.ts` |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Vercel KV; without them, local file stores under `apps/web/.data/` |

See [SPIKE.md](../SPIKE.md) for Etherfuse/Stellar quirks verified in sandbox.
