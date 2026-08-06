Vaivém is a React kit and Next.js apps for walletless USDC claim links with PIX/SPEI cash-out via a server-side Etherfuse quote.

```bash
npm install
```

```tsx
"use client"
import { RampWithdraw } from "@vaivem/react"

export default function Page() {
  return (
    <RampWithdraw amount={50} country="BR" apiBaseUrl=""
      onPaid={({ reference }) => console.log(reference)} />
  )
}
```

`apiBaseUrl` must point at a host that serves `POST /api/quote`. Empty string uses the same origin. Quotes are live against Etherfuse sandbox when `ETHERFUSE_API_KEY` is set; otherwise the route returns a mock quote with `source: "mock"`. PIX settlement and KYC in the kit UI are simulated.

| Provider | Corridor | Status |
|----------|----------|--------|
| Etherfuse | BRL / PIX | live in sandbox |
| Etherfuse | MXN / SPEI | live in sandbox |
| Mock | any | for testing |
| Manteca | BRL / PIX | interface defined, not implemented |

**Architecture.** `packages/vaivem-react` is the importable UI (`RampWithdraw`, `ClaimLink`, `useQuote`). `apps/web` hosts product pages and API routes (`/api/quote`, `/api/claims/*`, `/api/funding/*`). `apps/demo` imports the package and sets `apiBaseUrl` to `apps/web` (`NEXT_PUBLIC_VAIVEM_API`, default `http://localhost:3000`); it has no quote backend of its own. Provider HTTP calls (Etherfuse, Stellar Horizon) run only in server modules under `apps/web/lib/server/` and in route handlers. The API key is read from env on the server and never sent to the browser.

**Dashboard auth.** Senders sign in with an **email code** (6 digits). `POST /api/auth/request-code` stores `auth-code:{email}` in KV (10-minute TTL, rate-limited); `POST /api/auth/verify-code` creates or loads `user:{email}`, sets an httpOnly signed session cookie, and deletes the code. Sign-up and sign-in are the same flow — no passwords. Email is sent with **Resend** (`RESEND_API_KEY`, `EMAIL_FROM`). If Resend is unset, the code is logged on the server and returned as `{ devMode: true }` so local/demo login still works. Claims stay scoped by `ownerId` (the sender email). Recipient routes (`/claim/[token]`, `/api/claims/by-token/*`, `/api/quote`, `/api/payouts/*`) stay public — recipients never authenticate.

**Sender funding (demo ledger).** `/dashboard/funding` creates an Etherfuse **on-ramp** (sandbox: MXN → USDC, max 500 MXN; BRL is blocked with an explicit sandbox message). When the order completes, `GET /api/funding/[orderId]` credits `balance:{ownerId}` and appends a ledger entry. Creating a claim debits that balance first and rejects with a clear error when short. **This is not custody segregation:** the shared Stellar sponsor wallet still holds the real USDC and pays network fees. The per-sender balance is an internal accounting layer on top of that shared pool.

**Env (web).** `AUTH_SECRET` (session HMAC); optional `RESEND_API_KEY` + `EMAIL_FROM` for real email (omit for console/devMode codes); Etherfuse + Stellar sponsor vars as before; optional `ETHERFUSE_MXN_BANK_ACCOUNT_ID` / `ETHERFUSE_CRYPTO_WALLET_ID` (otherwise resolved from the org).

**What we did not build.** SMS / phone verification (paid provider + Brazilian carrier friction — out of scope for this demo), Google OAuth, passwords, batch payouts, embedded wallet, webhooks, multi-anchor routing, passkeys, production custody / per-user wallets, org roles and invites.
