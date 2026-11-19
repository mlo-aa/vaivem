// Records the REAL app (production build on Stellar testnet) state by state.
const { chromium } = require('playwright')
const fs = require('fs')
const OUT = process.argv[2]
const BASE = 'http://localhost:3111'
const meta = {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function box(page, locator) {
  try {
    const b = await locator.first().boundingBox({ timeout: 2500 })
    return b ? { x: b.x, y: b.y, w: b.width, h: b.height } : null
  } catch { return null }
}
async function shot(page, name, boxes = {}, opts = {}) {
  const file = `${name}.jpg`
  await page.screenshot({ path: `${OUT}/${file}`, type: 'jpeg', quality: 92, ...opts })
  const vp = page.viewportSize()
  const resolved = {}
  for (const [k, v] of Object.entries(boxes)) resolved[k] = typeof v === 'function' ? await v() : v
  meta[name] = { file, w: vp.width, h: vp.height, boxes: resolved }
  console.log('captured', name)
}
const withTheme = async (browser, theme, vp, dsf) => {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dsf })
  await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t) } catch {} }, theme)
  return ctx
}

;(async () => {
  const browser = await chromium.launch()
  const ctx = await withTheme(browser, 'dark', { width: 1440, height: 810 }, 2)
  const p = await ctx.newPage()

  // 1 — landing
  await p.goto(`${BASE}/en`, { waitUntil: 'domcontentloaded' })
  await sleep(4800)
  await shot(p, 'landing', {
    demoBtn: () => box(p, p.getByRole('button', { name: 'Try the demo' }).nth(1)),
    navDemo: () => box(p, p.getByRole('button', { name: 'Try the demo' }).first()),
    headline: () => box(p, p.locator('h1')),
    claimCard: () => box(p, p.getByText('CLAIM 7KQ2-X9')),
  })

  await p.setViewportSize({ width: 1440, height: 1000 })
  // 2 — demo login → dashboard
  await p.setViewportSize({ width: 1440, height: 810 })
  await p.getByRole('button', { name: 'Try the demo' }).nth(1).click()
  await p.setViewportSize({ width: 1440, height: 1000 })
  await p.waitForURL('**/dashboard', { timeout: 30000 })
  await sleep(2600)
  const dash = {
    balance: () => box(p, p.getByText('Demo ledger on a shared sponsor wallet')),
    badge: () => box(p, p.getByText('Demo · Testnet')),
    newClaim: () => box(p, p.getByText('New claim', { exact: true }).first()),
    sidebar: () => box(p, p.locator('aside')),
    empty: () => box(p, p.getByText('No claims yet')),
    theme: () => box(p, p.getByRole('button', { name: /theme|dark|light/i }).first()),
  }
  await shot(p, 'dashboard-dark', dash)

  // light variant
  await p.evaluate(() => { localStorage.setItem('theme', 'light') })
  await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2400)
  await shot(p, 'dashboard-light', dash)
  await p.evaluate(() => { localStorage.setItem('theme', 'dark') })
  await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2200)

  // 3 — create claim wizard
  await p.getByText('New claim', { exact: true }).first().click()
  await p.waitForURL('**/dashboard/create', { timeout: 20000 })
  await sleep(2000)
  const wiz1 = {
    amount: () => box(p, p.locator('#amount')),
    quote: () => box(p, p.getByText('Live quote')),
    stepper: () => box(p, p.getByText('Amount').first()),
    continueBtn: () => box(p, p.getByRole('button', { name: 'Continue' })),
    country: () => box(p, p.getByText('Brazil (PIX)')),
  }
  await shot(p, 'wizard-1-empty', wiz1)
  await p.locator('#amount').fill('')
  await p.locator('#amount').pressSequentially('25', { delay: 120 })
  await sleep(1800)
  await shot(p, 'wizard-1-filled', wiz1)
  await p.getByRole('button', { name: 'Continue' }).click()
  await sleep(1400)
  const wiz2 = {
    recipient: () => box(p, p.locator('#recipient')),
    message: () => box(p, p.locator('#message')),
    protection: () => box(p, p.getByText('Public link').first()),
    continueBtn: () => box(p, p.getByRole('button', { name: 'Continue' })),
  }
  await shot(p, 'wizard-2-empty', wiz2)
  await p.locator('#recipient').fill('Ana Souza')
  await p.getByText('Public link').first().click()
  await p.locator('#message').fill('Thanks for the great design work!')
  await sleep(800)
  await shot(p, 'wizard-2-filled', wiz2)
  await p.getByRole('button', { name: 'Continue' }).click()
  await sleep(1500)
  await shot(p, 'wizard-3-review', {
    fundBtn: () => box(p, p.getByRole('button', { name: 'Fund and create link' })),
    quote: () => box(p, p.getByText('Live quote')),
  })
  await p.getByRole('button', { name: 'Fund and create link' }).click()
  await sleep(1300)
  await shot(p, 'wizard-4-funding', { title: () => box(p, p.getByText('Locking funds on Stellar')) })
  await p.getByText('Your claim link is live').waitFor({ timeout: 60000 })
  await sleep(1000)
  await shot(p, 'wizard-5-done', {
    title: () => box(p, p.getByText('Your claim link is live')),
    viewBtn: () => box(p, p.getByRole('button', { name: 'View claim details' }).or(p.getByRole('link', { name: 'View claim details' }))),
  })
  await p.getByText('View claim details').click()
  await p.waitForURL('**/dashboard/claims/**', { timeout: 20000 })
  await sleep(2600)
  const token = p.url().split('/claims/')[1].split('?')[0]
  const detail = {
    qr: () => box(p, p.getByText('Scan to open the claim on any phone').locator('xpath=..')),
    share: () => box(p, p.getByText('Share', { exact: true })),
    whatsapp: () => box(p, p.getByRole('button', { name: 'WhatsApp' }).or(p.getByRole('link', { name: 'WhatsApp' }))),
    link: () => box(p, p.locator('input[readonly]').first()),
    status: () => box(p, p.getByText('Shared', { exact: true }).first()),
    timeline: () => box(p, p.getByText('Timeline')),
    amount: () => box(p, p.getByText('R$').first()),
  }
  await p.evaluate(() => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    document.querySelectorAll('input').forEach((i) => {
      if (i.value.includes('localhost:3111')) { set.call(i, i.value.replace('http://localhost:3111', 'https://tryvaivem.vercel.app')); i.dispatchEvent(new Event('input', { bubbles: true })) }
    })
  })
  await sleep(300)
  await shot(p, 'detail-created', detail)

  // 4 — recipient on a phone
  const mctx = await withTheme(browser, 'dark', { width: 390, height: 844 }, 3)
  const m = await mctx.newPage()
  await m.goto(`${BASE}/en/claim/${token}`, { waitUntil: 'domcontentloaded' })
  await sleep(2600)
  await shot(m, 'phone-1-choose', {
    hero: () => box(m, m.getByText('You received')),
    amount: () => box(m, m.getByText(/R\$/).first()),
    wallet: () => box(m, m.locator('#vv-wallet')),
    continueBtn: () => box(m, m.getByRole('button', { name: 'Continue' })),
  })
  await m.getByRole('button', { name: 'Continue' }).click()
  await sleep(900)
  await shot(m, 'phone-2-processing', {})
  await m.getByText('Money on the way!').waitFor({ timeout: 90000 })
  await sleep(900)
  await shot(m, 'phone-3-done', { tx: () => box(m, m.locator('a[href*="stellar.expert"]').first()) })

  // 5 — back on the dashboard: completed
  await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(3200)
  await shot(p, 'detail-completed', detail)
  await p.goto(`${BASE}/en/dashboard`, { waitUntil: 'domcontentloaded' }); await sleep(2800)
  await shot(p, 'dashboard-completed', { ...dash, row: () => box(p, p.getByText('Ana Souza').first()), balance2: () => box(p, p.getByText('USDC').first()) })

  meta.token = token
  fs.writeFileSync(`${OUT}/shots.json`, JSON.stringify(meta, null, 2))
  await browser.close()
  console.log('done, token', token)
})().catch((e) => { console.error('CAPTURE FAILED', e.message.slice(0, 400)); process.exit(1) })
