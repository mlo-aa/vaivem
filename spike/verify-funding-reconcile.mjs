/**
 * End-to-end verify: sync completed MXN on-ramps into apps/web/.data/funding-store.json
 */
import fs from "node:fs/promises"
import fsSync from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const webRoot = path.join(root, "apps", "web")
const storePath = path.join(webRoot, ".data", "funding-store.json")

function loadEnv(filePath) {
  if (!fsSync.existsSync(filePath)) return
  const text = fsSync.readFileSync(filePath, "utf8")
  for (const line of text.split(/\r?\n/)) {
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

loadEnv(path.join(webRoot, ".env.local"))
loadEnv(path.join(root, ".env.local"))

const BASE = process.env.ETHERFUSE_BASE_URL.replace(/\/$/, "")
const API = process.env.ETHERFUSE_API_KEY
const ORG = process.env.ETHERFUSE_ORG_ID
const ownerId = process.argv[2] ?? "funding-verify@test.local"

function roundUsdc(n) {
  return Math.round(n * 100) / 100
}

async function loadStore() {
  try {
    return JSON.parse(await fs.readFile(storePath, "utf8"))
  } catch {
    return { balances: {}, ledgers: {}, pending: {}, ownerPending: {} }
  }
}

async function saveStore(s) {
  await fs.mkdir(path.dirname(storePath), { recursive: true })
  await fs.writeFile(storePath, JSON.stringify(s, null, 2), "utf8")
}

async function ef(p) {
  const r = await fetch(`${BASE}${p}`, {
    headers: { Authorization: API, "Content-Type": "application/json" },
  })
  return r.json()
}

const store = await loadStore()
store.balances[ownerId] ??= {
  ownerId,
  amount: 0,
  updatedAt: new Date().toISOString(),
}
store.ledgers[ownerId] ??= []

const credited = new Set(
  store.ledgers[ownerId]
    .filter((e) => e.type === "deposit")
    .map((e) => e.ref),
)

const { items } = await ef(
  `/ramp/orders?customerId=${encodeURIComponent(ORG)}&pageSize=50`,
)

let creditedCount = 0
for (const order of items) {
  if (String(order.orderType).toLowerCase() !== "onramp") continue
  if (String(order.status).toLowerCase() !== "completed") continue
  if (credited.has(order.orderId)) continue
  const amount = roundUsdc(Number(order.amountInTokens))
  if (amount <= 0) continue

  store.balances[ownerId].amount = roundUsdc(
    store.balances[ownerId].amount + amount,
  )
  store.balances[ownerId].updatedAt = new Date().toISOString()
  store.ledgers[ownerId].unshift({
    id: crypto.randomUUID(),
    type: "deposit",
    amount,
    ref: order.orderId,
    createdAt: order.completedAt ?? new Date().toISOString(),
  })
  credited.add(order.orderId)
  creditedCount++
  delete store.pending[order.orderId]
}

await saveStore(store)

const deposits = store.ledgers[ownerId].filter((e) => e.type === "deposit")
const result = {
  ownerId,
  balance: store.balances[ownerId].amount,
  newlyCredited: creditedCount,
  depositCount: deposits.length,
  latestDeposit: deposits[0]
    ? { amount: deposits[0].amount, ref: `${deposits[0].ref.slice(0, 8)}…` }
    : null,
  pass: store.balances[ownerId].amount >= 2.89 && deposits.length >= 1,
}
console.log(JSON.stringify(result, null, 2))
if (!result.pass) process.exit(1)
