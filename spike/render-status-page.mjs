import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const pwPath =
  "C:/Users/emili/AppData/Local/Temp/cursor-sandbox-cache/9e9d5ecc2f61b87d664108249e33b211/npm/_npx/f0a362733743bae2/node_modules/playwright"
const { chromium } = require(pwPath)

const orderId = process.argv[2] ?? "6123bfe5-b980-4e30-9e62-8484304ea5b2"
const statusUrl = `https://sandbox.etherfuse.com/ramp/order/${orderId}`

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto(statusUrl, { waitUntil: "networkidle", timeout: 90000 })
await page.waitForTimeout(5000)

const before = await page.locator("body").innerText()
console.log("BEFORE_CLICK\n", before)

const btn = page.getByRole("button", { name: /Get Transfer Details/i }).or(
  page.getByText(/Get Transfer Details/i),
)
if (await btn.count()) {
  await btn.first().click()
  await page.waitForTimeout(5000)
}

const after = await page.locator("body").innerText()
console.log("\nAFTER_CLICK\n", after)
console.log("\nHAS_PIX", /pix/i.test(after))
console.log("HAS_COPIA", /copia/i.test(after))
console.log("HAS_QR", /qr|scan|escane/i.test(after))
console.log("CANVAS", await page.locator("canvas").count())

for (const el of await page.locator("input, textarea").all()) {
  const val = await el.inputValue().catch(() => "")
  if (val.length > 10) console.log("INPUT", val.slice(0, 400))
}

await browser.close()
