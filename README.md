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

**Architecture.** `packages/vaivem-react` is the importable UI (`RampWithdraw`, `ClaimLink`, `useQuote`). `apps/web` hosts product pages and API routes (`/api/quote`, `/api/claims/*`). `apps/demo` imports the package and sets `apiBaseUrl` to `apps/web` (`NEXT_PUBLIC_VAIVEM_API`, default `http://localhost:3000`); it has no quote backend of its own. Provider HTTP calls (Etherfuse, Stellar Horizon) run only in server modules under `apps/web/lib/server/` and in route handlers. The API key is read from env on the server and never sent to the browser.

**What we did not build.** Batch payouts, embedded wallet, webhooks, multi-anchor routing, passkeys, production deployment.
