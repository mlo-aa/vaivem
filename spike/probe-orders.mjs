/**
 * Probe Etherfuse for order-list endpoints + fetch known completed MXN onramps.
 * Sandbox only. Sanitized output.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

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

const BASE = (process.env.ETHERFUSE_BASE_URL || "").replace(/\/$/, "")
if (!/api\.sand\.etherfuse\.com$/i.test(new URL(BASE).host)) {
  throw new Error("not sandbox")
}
const API = process.env.ETHERFUSE_API_KEY
const ORG = process.env.ETHERFUSE_ORG_ID

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
  return typeof id === "string" && id.length > 12
    ? `${id.slice(0, 8)}…${id.slice(-4)}`
    : id
}

function summarizeOrder(o) {
  if (!o || typeof o !== "object") return o
  return {
    orderId: mid(o.orderId || o.id),
    status: o.status,
    type: o.type || o.quoteAssets?.type || o.onramp || o.offramp ? "has-ramp" : undefined,
    keys: Object.keys(o),
    sourceAmount: o.sourceAmount,
    destinationAmount: o.destinationAmount,
    currency: o.currency || o.quoteAssets?.sourceAsset,
    createdAt: o.createdAt,
  }
}

const probes = [
  `/ramp/orders?customerId=${encodeURIComponent(ORG)}`,
  `/ramp/order?customerId=${encodeURIComponent(ORG)}`,
  `/ramp/orders`,
  `/ramp/customer/${ORG}/orders`,
  `/ramp/customers/${ORG}/orders`,
]

for (const p of probes) {
  const res = await ef(p)
  const items = res.body?.items || res.body?.orders || (Array.isArray(res.body) ? res.body : null)
  console.log(
    JSON.stringify(
      {
        path: p.replace(ORG, "ORG"),
        http: res.status,
        keys: res.body && typeof res.body === "object" ? Object.keys(res.body) : typeof res.body,
        itemCount: Array.isArray(items) ? items.length : null,
        sample: Array.isArray(items) ? items.slice(0, 3).map(summarizeOrder) : null,
        error: res.body?.error || res.body?.message || res.body?.type,
      },
      null,
      2,
    ),
  )
}

// Local durable store if any
const dataPath = path.join(root, "apps", "web", ".data", "funding-store.json")
console.log(
  JSON.stringify(
    {
      localStoreExists: fs.existsSync(dataPath),
      dataPath: "apps/web/.data/funding-store.json",
    },
    null,
    2,
  ),
)
