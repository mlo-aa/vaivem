/**
 * Verify funding reconcile credits completed MXN on-ramps (sandbox).
 * Run: npx tsx apps/web/scripts/verify-funding-reconcile.ts [ownerId]
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function loadEnv(filePath: string) {
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

async function main() {
  process.chdir(webRoot)
  loadEnv(path.join(webRoot, ".env.local"))

  const ownerId = process.argv[2] ?? "funding-verify@test.local"

  const { reconcilePendingDeposits } = await import("../lib/server/reconcile-funding")
  const { getBalance, getLedger } = await import("../lib/server/balance-store")

  await reconcilePendingDeposits(ownerId)
  const balance = await getBalance(ownerId)
  const ledger = await getLedger(ownerId)
  const deposits = ledger.filter((e) => e.type === "deposit")

  const result = {
    ownerId,
    balance: balance.amount,
    depositCount: deposits.length,
    deposits: deposits.map((d) => ({
      amount: d.amount,
      ref: `${d.ref.slice(0, 8)}…`,
    })),
    pass: balance.amount >= 2.89 && deposits.length >= 1,
  }
  console.log(JSON.stringify(result, null, 2))

  if (!result.pass) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
