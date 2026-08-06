/**
 * Create one BRL on-ramp order in sandbox and print raw response keys.
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

const BASE = process.env.ETHERFUSE_BASE_URL.replace(/\/$/, "")
if (!/api\.sand\.etherfuse\.com$/i.test(new URL(BASE).host)) {
  throw new Error("not sandbox")
}
const API = process.env.ETHERFUSE_API_KEY
const ORG = process.env.ETHERFUSE_ORG_ID
const USDC = process.env.ETHERFUSE_USDC_ASSET
const BRL_BANK = process.env.ETHERFUSE_BRL_BANK_ACCOUNT_ID
const pub = Keypair.fromSecret(process.env.STELLAR_SPONSOR_SECRET).publicKey()

async function ef(p, init) {
  const r = await fetch(BASE + p, {
    ...init,
    headers: { Authorization: API, "Content-Type": "application/json", ...(init?.headers || {}) },
  })
  const text = await r.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: r.status, body, text }
}

const wallets = (await ef(`/ramp/wallets?customerId=${encodeURIComponent(ORG)}`)).body.items
const w = wallets.find((x) => x.publicKey === pub) || wallets.find((x) => x.blockchain === "stellar")

const quoteId = crypto.randomUUID()
const quoteReq = {
  quoteId,
  customerId: ORG,
  blockchain: "stellar",
  quoteAssets: { type: "onramp", sourceAsset: "BRL", targetAsset: USDC },
  sourceAmount: "10.00",
  walletAddress: w.publicKey,
}
const quoteRes = await ef("/ramp/quote", { method: "POST", body: JSON.stringify(quoteReq) })
console.log("QUOTE", quoteRes.status, JSON.stringify(quoteRes.body, null, 2))

if (quoteRes.status !== 200) process.exit(1)

const orderReq = {
  orderId: quoteRes.body.quoteId,
  quoteId: quoteRes.body.quoteId,
  customerId: ORG,
  bankAccountId: BRL_BANK,
  publicKey: w.publicKey,
  cryptoWalletId: w.walletId,
}
const orderRes = await ef("/ramp/order", { method: "POST", body: JSON.stringify(orderReq) })
console.log("ORDER", orderRes.status, orderRes.text || JSON.stringify(orderRes.body, null, 2))
if (orderRes.body?.onramp) {
  console.log("ONRAMP_KEYS", Object.keys(orderRes.body.onramp))
}

// Test BRL amount limits
for (const amt of ["500", "501", "600", "1000"]) {
  const qid = crypto.randomUUID()
  const r = await ef("/ramp/quote", {
    method: "POST",
    body: JSON.stringify({
      ...quoteReq,
      quoteId: qid,
      sourceAmount: `${amt}.00`,
    }),
  })
  console.log(`BRL_QUOTE_${amt}`, r.status, r.body?.type || r.body?.message || "ok")
}
