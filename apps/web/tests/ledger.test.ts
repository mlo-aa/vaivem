import { test } from "node:test"
import assert from "node:assert/strict"
import {
  creditDeposit,
  creditRefund,
  creditUsdcDeposit,
  debitForClaim,
  getBalance,
} from "@/lib/server/balance-store"

const owner = () => `t-${crypto.randomUUID()}@test.local`

test("same deposit credited once under concurrency", async () => {
  const o = owner()
  const tx = `tx-${crypto.randomUUID()}`
  const order = `order-${crypto.randomUUID()}`
  await Promise.all(Array.from({ length: 20 }, () => creditUsdcDeposit(o, 5, tx)))
  await Promise.all(Array.from({ length: 20 }, () => creditDeposit(o, 7, order)))
  assert.equal((await getBalance(o)).amount, 12)
})

test("concurrent debits never overspend", async () => {
  const o = owner()
  await creditDeposit(o, 15, `order-${crypto.randomUUID()}`)
  const res = await Promise.allSettled(
    Array.from({ length: 30 }, (_, i) => debitForClaim(o, 1, `T${i}`)),
  )
  assert.equal(res.filter((r) => r.status === "fulfilled").length, 15)
  assert.equal((await getBalance(o)).amount, 0)
})

test("refund is idempotent per claim", async () => {
  const o = owner()
  await Promise.all(Array.from({ length: 10 }, () => creditRefund(o, 3, "T0")))
  assert.equal((await getBalance(o)).amount, 3)
})
