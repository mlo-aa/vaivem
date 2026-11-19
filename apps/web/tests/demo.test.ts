import { test } from "node:test"
import assert from "node:assert/strict"
import { DEMO_EMAIL_DOMAIN, demoConfig, isDemoOwner } from "@/lib/server/demo"

test("only demo addresses are demo owners", () => {
  assert.ok(isDemoOwner(`demo-ab12@${DEMO_EMAIL_DOMAIN}`))
  assert.ok(isDemoOwner(`DEMO-AB12@${DEMO_EMAIL_DOMAIN.toUpperCase()}`))
  assert.ok(!isDemoOwner("ana@example.com"))
  assert.ok(!isDemoOwner(`${DEMO_EMAIL_DOMAIN}@example.com`))
  assert.ok(!isDemoOwner(null))
  assert.ok(!isDemoOwner(""))
})

test("demo limits have safe defaults and can be overridden", () => {
  const prev = process.env.DEMO_MAX_CLAIM_USDC
  delete process.env.DEMO_MAX_CLAIM_USDC
  assert.equal(demoConfig().maxClaimUsdc, 5)
  process.env.DEMO_MAX_CLAIM_USDC = "2"
  assert.equal(demoConfig().maxClaimUsdc, 2)
  process.env.DEMO_MAX_CLAIM_USDC = "-3"
  assert.equal(demoConfig().maxClaimUsdc, 5)
  if (prev === undefined) delete process.env.DEMO_MAX_CLAIM_USDC
  else process.env.DEMO_MAX_CLAIM_USDC = prev
})
