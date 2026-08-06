/**
 * Control quotes only — sandbox. No app changes. No order creation.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Keypair } from "@stellar/stellar-sdk"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const i = t.indexOf("=")
    if (i < 0) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1)
    if (!(k in process.env)) process.env[k] = v
  }
}
loadEnv(path.join(root, "apps", "web", ".env.local"))
loadEnv(path.join(root, ".env.local"))

const BASE = process.env.ETHERFUSE_BASE_URL.replace(/\/$/, "")
if (!/api\.sand\.etherfuse\.com$/i.test(new URL(BASE).host)) {
  throw new Error("not sandbox")
}
const API = process.env.ETHERFUSE_API_KEY
const ORG = process.env.ETHERFUSE_ORG_ID
const USDC = process.env.ETHERFUSE_USDC_ASSET
const pub = Keypair.fromSecret(process.env.STELLAR_SPONSOR_SECRET).publicKey()

async function ef(p, init) {
  const r = await fetch(BASE + p, {
    ...init,
    headers: {
      Authorization: API,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  })
  const t = await r.text()
  let b = null
  try {
    b = t ? JSON.parse(t) : null
  } catch {
    b = t
  }
  return { status: r.status, body: b }
}
function mid(id) {
  return id ? `${id.slice(0, 8)}…${id.slice(-4)}` : id
}

const wallets = (await ef(`/ramp/wallets?customerId=${encodeURIComponent(ORG)}`))
  .body.items
const w =
  wallets.find((x) => x.publicKey === pub) ||
  wallets.find((x) => x.blockchain === "stellar")

const tests = [
  {
    label: "CTRL MXN onramp 50",
    body: {
      quoteId: crypto.randomUUID(),
      customerId: ORG,
      blockchain: "stellar",
      quoteAssets: { type: "onramp", sourceAsset: "MXN", targetAsset: USDC },
      sourceAmount: "50.00",
      walletAddress: w.publicKey,
    },
  },
  {
    label: "CTRL USDC->BRL offramp 5",
    body: {
      quoteId: crypto.randomUUID(),
      customerId: ORG,
      blockchain: "stellar",
      quoteAssets: { type: "offramp", sourceAsset: USDC, targetAsset: "BRL" },
      sourceAmount: "5.00",
    },
  },
  {
    label: "BRL onramp no walletAddress 50",
    body: {
      quoteId: crypto.randomUUID(),
      customerId: ORG,
      blockchain: "stellar",
      quoteAssets: { type: "onramp", sourceAsset: "BRL", targetAsset: USDC },
      sourceAmount: "50.00",
    },
  },
  {
    label: "BRL onramp 500",
    body: {
      quoteId: crypto.randomUUID(),
      customerId: ORG,
      blockchain: "stellar",
      quoteAssets: { type: "onramp", sourceAsset: "BRL", targetAsset: USDC },
      sourceAmount: "500.00",
      walletAddress: w.publicKey,
    },
  },
]

for (const t of tests) {
  const res = await ef("/ramp/quote", {
    method: "POST",
    body: JSON.stringify(t.body),
  })
  const out = {
    label: t.label,
    http: res.status,
    type: res.body?.type,
    message: res.body?.message,
    error: res.body?.error,
    quoteId: res.body?.quoteId ? mid(res.body.quoteId) : undefined,
    sourceAmount: res.body?.sourceAmount,
    destinationAmount: res.body?.destinationAmount,
    exchangeRate: res.body?.exchangeRate,
    feeBps: res.body?.feeBps,
    feeAmount: res.body?.feeAmount,
    expiresAt: res.body?.expiresAt,
    createdAt: res.body?.createdAt,
    quoteAssets: res.body?.quoteAssets,
    keys:
      res.body && typeof res.body === "object" ? Object.keys(res.body) : [],
  }
  console.log(JSON.stringify(out, null, 2))
}
