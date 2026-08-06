/**
 * Create fresh BRL order and inspect public /update payload keys.
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
const API = process.env.ETHERFUSE_API_KEY
const ORG = process.env.ETHERFUSE_ORG_ID
const USDC = process.env.ETHERFUSE_USDC_ASSET
const BRL_BANK = process.env.ETHERFUSE_BRL_BANK_ACCOUNT_ID
const pub = Keypair.fromSecret(process.env.STELLAR_SPONSOR_SECRET).publicKey()
const AMOUNT = process.argv[2] ?? "12.00"

async function ef(p, init) {
  const r = await fetch(BASE + p, {
    ...init,
    headers: {
      Authorization: API,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
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

const wallets = (await ef(`/ramp/wallets?customerId=${encodeURIComponent(ORG)}`))
  .body.items
const w =
  wallets.find((x) => x.publicKey === pub) ||
  wallets.find((x) => x.blockchain === "stellar")

const quoteId = crypto.randomUUID()
const quoteRes = await ef("/ramp/quote", {
  method: "POST",
  body: JSON.stringify({
    quoteId,
    customerId: ORG,
    blockchain: "stellar",
    quoteAssets: { type: "onramp", sourceAsset: "BRL", targetAsset: USDC },
    sourceAmount: AMOUNT,
    walletAddress: w.publicKey,
  }),
})
if (quoteRes.status !== 200) {
  console.log("QUOTE_FAIL", quoteRes.status, quoteRes.text)
  process.exit(1)
}

const orderRes = await ef("/ramp/order", {
  method: "POST",
  body: JSON.stringify({
    orderId: quoteRes.body.quoteId,
    quoteId: quoteRes.body.quoteId,
    customerId: ORG,
    bankAccountId: BRL_BANK,
    publicKey: w.publicKey,
    cryptoWalletId: w.walletId,
  }),
})
console.log("ORDER", orderRes.status, JSON.stringify(orderRes.body, null, 2))

const id = orderRes.body?.onramp?.orderId
if (!id) process.exit(1)

const pubRes = await fetch(`${BASE.replace("api.sand", "api.sand")}/ramping/order/${id}/update`)
const pubBody = await pubRes.json()
console.log("PUBLIC_UPDATE", pubRes.status, JSON.stringify(pubBody, null, 2))
console.log("PUBLIC_KEYS", Object.keys(pubBody))

const getRes = await ef(`/ramp/order/${id}`)
console.log("GET_RAMP_ORDER", getRes.status, JSON.stringify(getRes.body, null, 2))
