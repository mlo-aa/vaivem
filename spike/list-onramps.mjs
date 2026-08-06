/**
 * Dump sanitized completed MXN on-ramp orders for recovery wiring.
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

const BASE = process.env.ETHERFUSE_BASE_URL.replace(/\/$/, "")
const API = process.env.ETHERFUSE_API_KEY
const ORG = process.env.ETHERFUSE_ORG_ID
const MXN_BANK = process.env.ETHERFUSE_MXN_BANK_ACCOUNT_ID

const r = await fetch(
  `${BASE}/ramp/orders?customerId=${encodeURIComponent(ORG)}&pageSize=50`,
  { headers: { Authorization: API, "Content-Type": "application/json" } },
)
const body = await r.json()
const items = body.items || []

const onramps = items.filter((o) => {
  const src = String(o.sourceAsset || "").toUpperCase()
  const hasClabe = Boolean(o.depositClabe)
  const type = String(o.orderType || "").toLowerCase()
  return (
    hasClabe ||
    type.includes("onramp") ||
    type.includes("on_ramp") ||
    src === "MXN" ||
    src === "BRL"
  )
})

for (const o of onramps) {
  console.log(
    JSON.stringify(
      {
        orderId: o.orderId,
        status: o.status,
        orderType: o.orderType,
        sourceAsset: o.sourceAsset,
        targetAsset: o.targetAsset,
        amountInFiat: o.amountInFiat,
        amountInTokens: o.amountInTokens,
        feeAmountInFiat: o.feeAmountInFiat,
        bankAccountIdMatchMxn: o.bankAccountId === MXN_BANK,
        bankAccountIdMasked: o.bankAccountId
          ? `${o.bankAccountId.slice(0, 8)}…`
          : null,
        hasDepositClabe: Boolean(o.depositClabe),
        completedAt: o.completedAt,
        createdAt: o.createdAt,
        confirmedTxSignature: o.confirmedTxSignature
          ? `${String(o.confirmedTxSignature).slice(0, 8)}…`
          : null,
      },
      null,
      2,
    ),
  )
}
console.log("onramp_count", onramps.length, "total", items.length)
