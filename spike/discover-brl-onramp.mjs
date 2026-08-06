/**
 * Read-only / non-destructive BRL on-ramp schema discovery against Etherfuse sandbox.
 * Does not modify apps/web. Does not pay Pix or credit any ledger.
 *
 * Usage: node spike/discover-brl-onramp.mjs
 * Loads apps/web/.env.local (or root .env.local).
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Keypair } from "@stellar/stellar-sdk"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, "utf8")
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
    ) {
      v = v.slice(1, -1)
    }
    if (!(k in process.env)) process.env[k] = v
  }
}

loadEnv(path.join(root, "apps", "web", ".env.local"))
loadEnv(path.join(root, ".env.local"))

const BASE_URL = process.env.ETHERFUSE_BASE_URL ?? ""
const API_KEY = process.env.ETHERFUSE_API_KEY
const ORG_ID = process.env.ETHERFUSE_ORG_ID
const USDC_ASSET =
  process.env.ETHERFUSE_USDC_ASSET ??
  "USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
const BRL_BANK_ENV = process.env.ETHERFUSE_BRL_BANK_ACCOUNT_ID
const MXN_BANK_ENV = process.env.ETHERFUSE_MXN_BANK_ACCOUNT_ID
const CRYPTO_WALLET_ENV = process.env.ETHERFUSE_CRYPTO_WALLET_ID
const SPONSOR_SECRET = process.env.STELLAR_SPONSOR_SECRET

function assertSandbox() {
  const u = BASE_URL.replace(/\/$/, "")
  const ok =
    u === "https://api.sand.etherfuse.com" ||
    /api\.sand\.etherfuse\.com$/i.test(new URL(u).host)
  if (!ok) {
    throw new Error(
      `Refusing to run: ETHERFUSE_BASE_URL is not sandbox (${maskUrl(u)})`,
    )
  }
  return u
}

function maskUrl(u) {
  try {
    const x = new URL(u)
    return `${x.protocol}//${x.host}`
  } catch {
    return "[invalid-url]"
  }
}

function maskId(id, keep = 8) {
  if (!id || typeof id !== "string") return id
  if (id.length <= keep + 4) return `${id.slice(0, 2)}…`
  return `${id.slice(0, keep)}…${id.slice(-4)}`
}

function maskPub(pk) {
  if (!pk || typeof pk !== "string") return pk
  return `${pk.slice(0, 4)}…${pk.slice(-4)}`
}

function maskSensitiveString(s) {
  if (s == null) return s
  const str = String(s)
  if (str.length <= 6) return "***"
  return `${str.slice(0, 2)}***${str.slice(-2)} (len=${str.length})`
}

const SENSITIVE_KEY =
  /(clabe|pix|cpf|cnpj|accountNumber|account_number|iban|routing|taxId|tax_id|document|email|phone|name|holder|memo|secret|key|address(?!Id))/i

function sanitize(value, keyHint = "") {
  if (value == null) return value
  if (typeof value === "string") {
    if (SENSITIVE_KEY.test(keyHint)) return maskSensitiveString(value)
    if (/^G[A-Z0-9]{55}$/.test(value)) return maskPub(value)
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      )
    ) {
      return maskId(value)
    }
    if (/^\d{10,}$/.test(value) && SENSITIVE_KEY.test(keyHint)) {
      return maskSensitiveString(value)
    }
    return value
  }
  if (typeof value === "number" || typeof value === "boolean") return value
  if (Array.isArray(value)) return value.map((v, i) => sanitize(v, `${keyHint}[${i}]`))
  if (typeof value === "object") {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      if (/secret|privateKey|apiKey|authorization/i.test(k)) {
        out[k] = "[redacted]"
        continue
      }
      out[k] = sanitize(v, k)
    }
    return out
  }
  return String(value)
}

async function ef(pathname, init) {
  if (!API_KEY) throw new Error("ETHERFUSE_API_KEY missing")
  const res = await fetch(`${BASE_URL.replace(/\/$/, "")}${pathname}`, {
    ...init,
    headers: {
      Authorization: API_KEY,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  })
  const text = await res.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: res.status, ok: res.ok, body }
}

function section(title) {
  console.log("\n" + "=".repeat(72))
  console.log(title)
  console.log("=".repeat(72))
}

async function main() {
  const base = assertSandbox()
  section("0. Environment (sanitized)")
  console.log(
    JSON.stringify(
      {
        baseUrl: maskUrl(base),
        sandboxConfirmed: true,
        orgId: maskId(ORG_ID ?? ""),
        usdcAsset: USDC_ASSET,
        brlBankEnvSet: Boolean(BRL_BANK_ENV),
        brlBankEnvMasked: BRL_BANK_ENV ? maskId(BRL_BANK_ENV) : null,
        mxnBankEnvMasked: MXN_BANK_ENV ? maskId(MXN_BANK_ENV) : null,
        cryptoWalletEnvMasked: CRYPTO_WALLET_ENV
          ? maskId(CRYPTO_WALLET_ENV)
          : null,
        sponsorSecretConfigured: Boolean(SPONSOR_SECRET),
        apiKeyConfigured: Boolean(API_KEY),
        apiKeyLooksSandbox: String(API_KEY ?? "").startsWith("api_sand:"),
      },
      null,
      2,
    ),
  )

  if (!SPONSOR_SECRET) throw new Error("STELLAR_SPONSOR_SECRET missing")
  const sponsorPub = Keypair.fromSecret(SPONSOR_SECRET).publicKey()

  // --- wallets ---
  section("1a. GET /ramp/wallets")
  const walletsRes = await ef(
    `/ramp/wallets?customerId=${encodeURIComponent(ORG_ID)}`,
  )
  console.log("HTTP", walletsRes.status)
  const wallets = walletsRes.body?.items ?? []
  const walletSummary = wallets.map((w) => ({
    walletId: maskId(w.walletId),
    publicKey: maskPub(w.publicKey),
    blockchain: w.blockchain,
    customerId: w.customerId ? maskId(w.customerId) : undefined,
    matchesSponsor: w.publicKey === sponsorPub,
    matchesEnvWallet: CRYPTO_WALLET_ENV
      ? w.walletId === CRYPTO_WALLET_ENV
      : false,
  }))
  console.log(JSON.stringify(sanitize(walletSummary), null, 2))

  let wallet =
    wallets.find((w) => w.publicKey === sponsorPub && w.blockchain === "stellar") ??
    wallets.find((w) => w.blockchain === "stellar")
  if (CRYPTO_WALLET_ENV) {
    wallet = wallets.find((w) => w.walletId === CRYPTO_WALLET_ENV) ?? wallet
  }
  if (!wallet) throw new Error("No Stellar wallet found on org")
  console.log(
    "Using wallet:",
    JSON.stringify({
      walletId: maskId(wallet.walletId),
      publicKey: maskPub(wallet.publicKey),
    }),
  )

  // --- assets ---
  section("1b. GET /ramp/assets (BRL + stellar + wallet) — listAssets schema")
  // Mirrors apps/web/lib/server/etherfuse.ts listAssets({ blockchain, currency, wallet })
  const assetsQs = new URLSearchParams({
    blockchain: "stellar",
    currency: "BRL",
    wallet: wallet.publicKey,
  })
  const assetsRes = await ef(`/ramp/assets?${assetsQs}`)
  console.log("HTTP", assetsRes.status)
  console.log("query params used:", Object.fromEntries(assetsQs))
  console.log(JSON.stringify(sanitize(assetsRes.body), null, 2))

  // Also try MXN for comparison shape
  section("1c. GET /ramp/assets (MXN) for shape comparison")
  const mxnQs = new URLSearchParams({
    blockchain: "stellar",
    currency: "MXN",
    wallet: wallet.publicKey,
  })
  const mxnAssetsRes = await ef(`/ramp/assets?${mxnQs}`)
  console.log("HTTP", mxnAssetsRes.status)
  console.log(JSON.stringify(sanitize(mxnAssetsRes.body), null, 2))

  // --- bank accounts ---
  section("2. GET /ramp/bank-accounts")
  const banksRes = await ef(
    `/ramp/bank-accounts?customerId=${encodeURIComponent(ORG_ID)}`,
  )
  console.log("HTTP", banksRes.status)
  const banks = banksRes.body?.items ?? []
  const bankSummary = banks.map((b) => {
    const keys = Object.keys(b)
    const currency = b.currency
    const structural = {
      bankAccountId: maskId(b.bankAccountId),
      currency,
      status: b.status,
      compliant: b.compliant,
      deletedAt: b.deletedAt ?? null,
      matchesBrlEnv: BRL_BANK_ENV ? b.bankAccountId === BRL_BANK_ENV : false,
      matchesMxnEnv: MXN_BANK_ENV ? b.bankAccountId === MXN_BANK_ENV : false,
      fieldNames: keys,
    }
    // Surface non-sensitive capability-ish fields only
    for (const k of keys) {
      if (
        /type|rail|method|direction|onramp|offramp|pix|spei|capability|purpose|kind|country/i.test(
          k,
        )
      ) {
        structural[k] = sanitize(b[k], k)
      }
    }
    return structural
  })
  console.log(JSON.stringify(bankSummary, null, 2))

  const brlBanks = banks.filter(
    (b) => String(b.currency ?? "").toLowerCase() === "brl" && !b.deletedAt,
  )
  const brlBank =
    (BRL_BANK_ENV && banks.find((b) => b.bankAccountId === BRL_BANK_ENV)) ||
    brlBanks[0]
  console.log(
    "Selected BRL bank:",
    brlBank
      ? {
          bankAccountId: maskId(brlBank.bankAccountId),
          currency: brlBank.currency,
          status: brlBank.status,
          compliant: brlBank.compliant,
          isEnvETHERFUSE_BRL_BANK_ACCOUNT_ID: BRL_BANK_ENV
            ? brlBank.bankAccountId === BRL_BANK_ENV
            : false,
        }
      : null,
  )

  // Infer asset identifiers from assets response
  const assetList = Array.isArray(assetsRes.body?.assets)
    ? assetsRes.body.assets
    : Array.isArray(assetsRes.body)
      ? assetsRes.body
      : []

  section("1d. Asset identifier inference")
  console.log(
    JSON.stringify(
      {
        assetCount: assetList.length,
        sampleKeys: assetList[0] ? Object.keys(assetList[0]) : [],
        sanitizedAssets: sanitize(assetList),
        proposedSourceAsset: "BRL",
        proposedTargetAsset: USDC_ASSET,
        note: "sourceAsset/targetAsset for quotes historically use fiat code + USDC:ISSUER string (see createQuote / deposit route)",
      },
      null,
      2,
    ),
  )

  if (!brlBank) {
    section("STOP — no BRL bank account")
    console.log("Cannot attempt BRL on-ramp quote/order without a BRL bank account.")
    return
  }

  // --- quote ---
  // Try small amounts; SPIKE notes 1 USDC floor for offramp — for onramp try modest BRL
  const amountsToTry = ["10.00", "50.00", "100.00", "5.00", "1.00"]
  let quote = null
  let quoteReq = null
  let quoteHttp = null
  let lastQuoteErr = null

  section("3. POST /ramp/quote (BRL on-ramp)")
  for (const amount of amountsToTry) {
    const quoteId = crypto.randomUUID()
    quoteReq = {
      quoteId,
      customerId: ORG_ID,
      blockchain: "stellar",
      quoteAssets: {
        type: "onramp",
        sourceAsset: "BRL",
        targetAsset: USDC_ASSET,
      },
      sourceAmount: amount,
      walletAddress: wallet.publicKey,
    }
    console.log("\nAttempt amount BRL", amount)
    console.log(
      "Request (sanitized):",
      JSON.stringify(
        {
          ...quoteReq,
          customerId: maskId(quoteReq.customerId),
          walletAddress: maskPub(quoteReq.walletAddress),
        },
        null,
        2,
      ),
    )
    const qRes = await ef("/ramp/quote", {
      method: "POST",
      body: JSON.stringify(quoteReq),
    })
    quoteHttp = qRes.status
    console.log("HTTP", qRes.status)
    console.log("Response (sanitized):", JSON.stringify(sanitize(qRes.body), null, 2))
    if (qRes.ok) {
      quote = qRes.body
      quote._requestAmount = amount
      quote._quoteIdUsed = quoteId
      break
    }
    lastQuoteErr = qRes.body
    // If clearly unsupported, don't spam
    const errStr = JSON.stringify(qRes.body ?? "")
    if (/not.?supported|unavailable|FailedToGetQuote|onramp/i.test(errStr) && amount === amountsToTry[0]) {
      // still try a couple amounts
    }
  }

  if (!quote) {
    section("QUOTE FAILED — no order will be created")
    console.log(
      JSON.stringify(
        {
          lastHttp: quoteHttp,
          lastErrorSanitized: sanitize(lastQuoteErr),
          conclusion:
            "BRL on-ramp quote did not succeed with tested amounts. Do not claim BRL works.",
        },
        null,
        2,
      ),
    )
    return
  }

  section("3b. Quote fields for Vaivém")
  console.log(
    JSON.stringify(
      {
        quoteId: maskId(quote.quoteId ?? quote._quoteIdUsed),
        sourceAmount: quote.sourceAmount,
        destinationAmount: quote.destinationAmount,
        exchangeRate: quote.exchangeRate,
        etherfuseMidMarketRate: quote.etherfuseMidMarketRate,
        nominalRate: quote.nominalRate,
        feeBps: quote.feeBps,
        feeAmount: quote.feeAmount,
        createdAt: quote.createdAt,
        expiresAt: quote.expiresAt,
        requiresSwap: quote.requiresSwap,
        quoteAssets: sanitize(quote.quoteAssets),
        allTopLevelKeys: Object.keys(quote).filter((k) => !k.startsWith("_")),
      },
      null,
      2,
    ),
  )

  // --- order ---
  section("4. POST /ramp/order (BRL on-ramp) — sandbox only, do not pay")
  const orderBody = {
    orderId: quote.quoteId ?? quote._quoteIdUsed,
    quoteId: quote.quoteId ?? quote._quoteIdUsed,
    customerId: ORG_ID,
    bankAccountId: brlBank.bankAccountId,
    publicKey: wallet.publicKey,
    cryptoWalletId: wallet.walletId,
  }
  console.log(
    "Request (sanitized):",
    JSON.stringify(
      {
        ...orderBody,
        customerId: maskId(orderBody.customerId),
        bankAccountId: maskId(orderBody.bankAccountId),
        publicKey: maskPub(orderBody.publicKey),
        cryptoWalletId: maskId(orderBody.cryptoWalletId),
      },
      null,
      2,
    ),
  )
  const orderRes = await ef("/ramp/order", {
    method: "POST",
    body: JSON.stringify(orderBody),
  })
  console.log("HTTP", orderRes.status)
  console.log("Response (sanitized):", JSON.stringify(sanitize(orderRes.body), null, 2))

  if (orderRes.ok && orderRes.body) {
    const onramp = orderRes.body.onramp ?? orderRes.body
    const mxnShape = [
      "depositClabe",
      "depositAmount",
      "depositBankName",
      "depositAccountHolder",
    ]
    const present = Object.keys(onramp ?? {})
    section("4b. BRL vs MXN instruction field comparison")
    console.log(
      JSON.stringify(
        {
          responseTopLevelKeys: Object.keys(orderRes.body),
          onrampOrInstructionKeys: present,
          mxnFieldsPresent: Object.fromEntries(
            mxnShape.map((f) => [f, f in (onramp ?? {})]),
          ),
          possiblePixFields: present.filter((k) =>
            /pix|qr|brcode|copia|cola|emv|payload|code/i.test(k),
          ),
          hasClaimableBalance: present.some((k) => /claimable/i.test(k)),
          hasXdr: present.some((k) => /xdr/i.test(k)),
          hasStellarTx: present.some((k) => /hash|stellar|transaction/i.test(k)),
        },
        null,
        2,
      ),
    )
  }

  // --- status ---
  const orderId =
    orderRes.body?.onramp?.orderId ??
    orderRes.body?.orderId ??
    orderBody.orderId
  if (orderRes.ok && orderId) {
    section("5. GET /ramp/order/{orderId}")
    const st = await ef(`/ramp/order/${encodeURIComponent(orderId)}`)
    console.log("HTTP", st.status)
    console.log("Response (sanitized):", JSON.stringify(sanitize(st.body), null, 2))
    console.log(
      "Top-level keys:",
      st.body && typeof st.body === "object" ? Object.keys(st.body) : [],
    )
  }

  section("6. Ledger credit recommendation (analysis only)")
  console.log(
    JSON.stringify(
      {
        quoteDestinationAmount: quote.destinationAmount,
        orderExposesDestination:
          orderRes.body &&
          JSON.stringify(orderRes.body).includes("destination"),
        note: "See final report section J after reviewing status payload for delivered amount / stellar hash fields.",
      },
      null,
      2,
    ),
  )

  section("DONE")
  console.log(
    JSON.stringify(
      {
        brlQuoteSucceeded: true,
        brlOrderSucceeded: Boolean(orderRes.ok),
        quoteAmountBRL: quote._requestAmount,
        orderHttp: orderRes.status,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error("DISCOVERY_FAILED", err instanceof Error ? err.message : err)
  process.exit(1)
})
