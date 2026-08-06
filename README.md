# Vaivém

Walletless USDC claim links with PIX/SPEI cash-out (Etherfuse + Stellar).

```bash
npm install
```

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

`apiBaseUrl` must host `POST /api/quote`. Empty string uses the same origin. Live Etherfuse sandbox quotes when `ETHERFUSE_API_KEY` is set; otherwise mock (`source: "mock"`). Kit PIX settlement and KYC remain simulated.

| Provider | Corridor | Status |
|----------|----------|--------|
| Etherfuse | BRL / PIX on-ramp (funding) | live in sandbox (≤500 BRL) |
| Etherfuse | MXN / SPEI on-ramp (funding) | live in sandbox (≤500 MXN) |
| Etherfuse | USDC → BRL / PIX off-ramp | live in sandbox |
| Etherfuse | USDC → MXN / SPEI off-ramp | live in sandbox |
| Mock | any | outage fallback / local testing |
| Manteca | BRL / PIX | interface only — not implemented |

**Not built:** production custody / per-user wallets, webhooks delivery, SMS verification, Google OAuth, passwords, passkeys, multi-anchor routing, org roles.

Longer architecture and env notes: [docs/architecture.md](docs/architecture.md). Verified provider findings: [SPIKE.md](SPIKE.md).
