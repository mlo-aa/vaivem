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

const BASE = process.env.ETHERFUSE_BASE_URL.replace(/\/$/, "")
const API = process.env.ETHERFUSE_API_KEY
const ORG = process.env.ETHERFUSE_ORG_ID

async function ef(p, init) {
  const r = await fetch(BASE + p, {
    ...init,
    headers: { Authorization: API, "Content-Type": "application/json" },
  })
  const t = await r.text()
  let b = null
  try {
    b = t ? JSON.parse(t) : null
  } catch {
    b = t
  }
  return { status: r.status, body: b, text: t }
}

const list = (await ef(`/ramp/orders?customerId=${encodeURIComponent(ORG)}&pageSize=50`))
  .body.items
const brl = list.filter(
  (o) =>
    String(o.sourceAsset).toUpperCase() === "BRL" &&
    String(o.orderType).toLowerCase() === "onramp",
)

const id = process.argv[2] || "65872d3f-bfc1-4c90-ba12-10fb71ddf1a8"
const detail = await ef(`/ramp/order/${encodeURIComponent(id)}`)
console.log(JSON.stringify(detail.body, null, 2))
