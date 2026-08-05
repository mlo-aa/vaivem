# `@vaivem/react`

Importable React kit: walletless claim UI and PIX ramp withdraw. Quotes are
fetched from the host backend; this package never embeds API keys.

## Install

```bash
npm install @vaivem/react
```

Peer: `react` / `react-dom` 18+.

## `apiBaseUrl`

All network calls go to `{apiBaseUrl}/api/quote` (POST JSON
`{ amount, country }`).

| Value | Behavior |
|-------|----------|
| `""` (default) | Same origin — use when the host app serves `/api/quote` |
| `"http://localhost:3000"` | Point at `apps/web` from another app (e.g. `apps/demo`) |

Set it per component, or from env in the host:

```tsx
<RampWithdraw
  amount={120}
  country="BR"
  apiBaseUrl={process.env.NEXT_PUBLIC_VAIVEM_API ?? "http://localhost:3000"}
  onPaid={({ reference }) => console.log(reference)}
/>
```

`ClaimLink` and `useQuote` accept the same `apiBaseUrl` option. The browser
must be allowed to call that origin (CORS). `apps/web`'s `/api/quote` route
sends permissive CORS headers for this.

## Minimum amount

`MIN_AMOUNT_USDC` is **1 USDC**. Etherfuse answers offramp quotes below that with
HTTP **424**, and behaviour in the 0.4–0.5 range is inconsistent: 0.42 and 0.50
succeed while 0.39, 0.45 and 0.48 fail repeatably. Treat 1 USDC as the floor.

`RampWithdraw` validates the amount before any request goes out and shows the
minimum in the recipient's currency at the current rate. Host apps can reuse the
same helpers:

```tsx
import { MIN_AMOUNT_USDC, isBelowMinimum, minAmountMessage } from "@vaivem/react"

if (isBelowMinimum(amount)) return <p>{minAmountMessage("BR")}</p>
```

## Quote errors vs. provider outages

The two cases are presented differently, because they mean different things:

| Case | Backend | UI |
|------|---------|----|
| Invalid request (4xx, e.g. below the minimum) | error + upstream status, no quote | actual reason inline next to the amount |
| Provider down (5xx, timeout, network) | mock quote with `source: "mock"` | amber "Simulated quote — live provider unavailable" |

The mock fallback exists for **outages only** — never for invalid requests. A 4xx
is surfaced as a `QuoteError` with `kind: "invalid"` and is not auto-retried,
since the same request would fail identically.

## Exports

- `<RampWithdraw amount country onPaid onFailed onStatus apiBaseUrl claimToken />` —
  KYC gate, live quote + countdown, PIX form, real payout + failure states
- `<ClaimLink onClaimed apiBaseUrl claimToken />` — unlock + rail choose + ramp
- `useQuote(amount, country, { apiBaseUrl })` — quote + 120s countdown
- `MIN_AMOUNT_USDC`, `isBelowMinimum`, `minAmountMessage`, `minAmountInFiat`, `formatFiat`
- `QuoteError`, `PayoutError`
- Types: `Quote`, `KycStatus`, `PixKeyType`, `RampProvider`, `QuoteErrorKind`,
  `PayoutFailureCode`
