import { test } from "node:test"
import assert from "node:assert/strict"
import { generateClaimToken } from "@/lib/server/claim-store"
import { hashAccessCode, verifyAccessCode } from "@/lib/server/access-code"
import { hit, tryLock, safeEqual } from "@/lib/server/rate-limit"
import { createAuthCode, verifyAuthCode } from "@/lib/server/auth-code-store"

test("claim tokens: 12 chars from the safe alphabet, no repeats in 5000", () => {
  const seen = new Set<string>()
  for (let i = 0; i < 5000; i++) {
    const t = generateClaimToken()
    assert.match(t, /^[A-HJ-NP-Z2-9]{12}$/)
    seen.add(t)
  }
  assert.equal(seen.size, 5000)
})

test("access codes are hashed and verified (legacy plaintext still works)", () => {
  const h = hashAccessCode("s3cret")
  assert.notEqual(h, "s3cret")
  assert.ok(verifyAccessCode(h, "s3cret"))
  assert.ok(!verifyAccessCode(h, "nope"))
  assert.ok(verifyAccessCode("legacy", "legacy"))
  assert.ok(!verifyAccessCode(null, "x"))
})

test("rate limiter counts atomically", async () => {
  const key = `k-${crypto.randomUUID()}`
  const r = await Promise.all(Array.from({ length: 12 }, () => hit(key, 5, 60)))
  assert.equal(r.filter((x) => x.ok).length, 5)
})

test("tryLock is exclusive until released", async () => {
  const key = `l-${crypto.randomUUID()}`
  const a = await tryLock(key, 30)
  assert.ok(a)
  assert.equal(await tryLock(key, 30), null)
  await a!()
  assert.ok(await tryLock(key, 30))
})

test("safeEqual", () => {
  assert.ok(safeEqual("abc", "abc"))
  assert.ok(!safeEqual("abc", "abd"))
})

test("OTP: parallel wrong guesses are capped, wrong guesses lock the code", async () => {
  const email = `otp-${crypto.randomUUID()}@test.local`
  const created = await createAuthCode(email)
  assert.ok(created.ok)
  const wrong = created.ok && created.code === "000000" ? "111111" : "000000"
  const res = await Promise.all(Array.from({ length: 12 }, () => verifyAuthCode(email, wrong)))
  assert.equal(res.filter((r) => !r.ok && r.error === "invalid").length <= 5, true)
  assert.ok(res.some((r) => !r.ok && r.error === "too_many_attempts"))
})
