/**
 * Creates a fresh Stellar TESTNET sponsor for the public demo:
 *   - an issuer for a test "USDC" asset (worthless, testnet only)
 *   - a sponsor account funded by Friendbot, with a trustline and 2000 test USDC
 *
 * Run from the repo root (works on Windows, macOS and Linux):
 *   node apps/web/scripts/create-testnet-sponsor.mjs
 *
 * It prints the environment variables to paste into Vercel. The secret is shown
 * only in your terminal — do not share it. Testnet resets periodically, so rerun
 * this if the sponsor disappears (see GET /api/health).
 */
import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk"

const HORIZON = "https://horizon-testnet.stellar.org"
const server = new Horizon.Server(HORIZON)

async function friendbot(address) {
  const res = await fetch(`https://friendbot.stellar.org/?addr=${address}`)
  if (!res.ok) throw new Error(`Friendbot failed (${res.status}): ${(await res.text()).slice(0, 160)}`)
}

async function submit(source, operations) {
  const account = await server.loadAccount(source.publicKey())
  const builder = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
  for (const op of operations) builder.addOperation(op)
  const tx = builder.setTimeout(60).build()
  tx.sign(source)
  return server.submitTransaction(tx)
}

const issuer = Keypair.random()
const sponsor = Keypair.random()

console.log("Funding accounts with Friendbot…")
await friendbot(issuer.publicKey())
await friendbot(sponsor.publicKey())

const usdc = new Asset("USDC", issuer.publicKey())
console.log("Creating trustline and minting 2000 test USDC…")
await submit(sponsor, [Operation.changeTrust({ asset: usdc })])
await submit(issuer, [
  Operation.payment({ destination: sponsor.publicKey(), asset: usdc, amount: "2000" }),
])

console.log("\nDone. Set these in Vercel (Production and Preview), then redeploy:\n")
console.log(`STELLAR_SPONSOR_SECRET=${sponsor.secret()}`)
console.log(`STELLAR_USDC_ISSUER=${issuer.publicKey()}`)
console.log(`ETHERFUSE_USDC_ASSET=USDC:${issuer.publicKey()}`)
console.log("STELLAR_NETWORK=testnet")
console.log(`\nSponsor address (public): ${sponsor.publicKey()}`)
console.log("Check it afterwards at /api/health — sponsor.exists should be true.")
