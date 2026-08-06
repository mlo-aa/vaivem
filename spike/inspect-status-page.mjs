/**
 * Render Etherfuse BRL status page with Playwright (via npx package).
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
let chromium
try {
  ;({ chromium } = require("playwright"))
} catch {
  try {
    const npxRoot = path.join(
      process.env.APPDATA ?? "",
      "npm",
      "node_modules",
      "playwright",
    )
    ;({ chromium } = require(npxRoot))
  } catch {
    console.log("PLAYWRIGHT_UNAVAILABLE")
    process.exit(0)
  }
}

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

const orderId = process.argv[2] ?? "9589b5ca-492c-456a-ac63-30d6b68587aa"
const BASE = process.env.ETHERFUSE_BASE_URL.replace(/\/$/, "")
const API = process.env.ETHERFUSE_API_KEY

const detail = await fetch(`${BASE}/ramp/order/${orderId}`, {
  headers: { Authorization: API },
}).then((r) => r.json())

const statusUrl =
  detail.statusPage ??
  `https://sandbox.etherfuse.com/ramp/order/${orderId}`

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

const apiCalls = []
page.on("response", async (res) => {
  const u = res.url()
  if (u.includes("etherfuse") && (u.includes("order") || u.includes("ramp"))) {
    let body = ""
    try {
      body = (await res.text()).slice(0, 1200)
    } catch {
      /* */
    }
    apiCalls.push({ url: u, status: res.status(), body })
  }
})

await page.goto(statusUrl, { waitUntil: "networkidle", timeout: 90000 })
await page.waitForTimeout(8000)

const bodyText = await page.locator("body").innerText()
const lower = bodyText.toLowerCase()

console.log("STATUS_URL", statusUrl)
console.log("PAGE_TEXT", bodyText)
console.log("HAS_PIX", lower.includes("pix"))
console.log("HAS_COPIA", lower.includes("copia"))
console.log("HAS_SCAN", lower.includes("scan") || lower.includes("escane"))
console.log("CANVAS", await page.locator("canvas").count())
console.log("SVG", await page.locator("svg").count())

for (const el of await page.locator("input, textarea").all()) {
  const val = await el.inputValue().catch(() => "")
  if (val.length > 20) console.log("INPUT", val.slice(0, 300))
}

console.log("API_CALLS")
for (const c of apiCalls) {
  console.log(c.status, c.url)
  console.log(c.body.slice(0, 800))
}

await browser.close()
