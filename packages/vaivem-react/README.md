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

## Exports

- `<RampWithdraw amount country onPaid apiBaseUrl />` — KYC gate, live quote +
  countdown, PIX form (settlement/KYC steps are simulated in the kit)
- `<ClaimLink code onClaimed apiBaseUrl />` — unlock + rail choose + ramp
- `useQuote(amount, country, { apiBaseUrl })` — quote + 120s countdown
- Types: `Quote`, `KycStatus`, `PixKeyType`, `RampProvider`
