/**
 * Vaivém — spike de Stellar (testnet)
 *
 * Valida las cinco primitivas de las que depende el producto:
 *   1. cuenta patrocinada (el receptor no paga reserva)
 *   2. trustline patrocinada (el receptor no paga reserva del asset)
 *   3. claimable balance con expiración
 *   4. reclamo por parte del receptor SIN tener XLM (fee bump)
 *   5. recuperación por el emisor cuando expira
 *
 * Uso:
 *   npm install @stellar/stellar-sdk
 *   node spike.mjs setup
 *   node spike.mjs sponsor
 *   node spike.mjs create 50
 *   node spike.mjs claim
 *   node spike.mjs create-short     (expira en 90s)
 *   node spike.mjs recover          (correr después de que expire)
 *   node spike.mjs status
 */

import {
  Keypair, Horizon, TransactionBuilder, Operation, Asset,
  Networks, BASE_FEE, Claimant,
} from "@stellar/stellar-sdk";
import fs from "node:fs";

const HORIZON = "https://horizon-testnet.stellar.org";
const NET = Networks.TESTNET;
const STATE = "./spike-state.json";
const server = new Horizon.Server(HORIZON);

const load = () => (fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE)) : {});
const save = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 2));
const log = (...a) => console.log(...a);

async function fund(pub) {
  const r = await fetch(`https://friendbot.stellar.org?addr=${pub}`);
  if (!r.ok) throw new Error(`friendbot falló: ${r.status}`);
}

async function submit(tx, label) {
  try {
    const res = await server.submitTransaction(tx);
    log(`  ✓ ${label}`);
    log(`    ${res.hash}`);
    return res;
  } catch (e) {
    const rc = e?.response?.data?.extras?.result_codes;
    log(`  ✗ ${label}`);
    log("   ", JSON.stringify(rc ?? e.message, null, 2));
    throw e;
  }
}

/* ── 1. setup ─────────────────────────────────────────────────────────────
   Crea issuer (emite el asset de prueba) y sponsor (paga todas las reservas).
   El sponsor hace de "empresa que envía el pago".                          */
async function setup() {
  const issuer = Keypair.random();
  const sponsor = Keypair.random();
  const recipient = Keypair.random(); // NUNCA se fondea: ese es el punto

  log("Fondeando issuer y sponsor con friendbot…");
  await fund(issuer.publicKey());
  await fund(sponsor.publicKey());

  const USDC = new Asset("USDC", issuer.publicKey());

  // El sponsor acepta el asset y el issuer le emite 1000
  const acc = await server.loadAccount(sponsor.publicKey());
  const trust = new TransactionBuilder(acc, { fee: BASE_FEE, networkPassphrase: NET })
    .addOperation(Operation.changeTrust({ asset: USDC }))
    .setTimeout(60).build();
  trust.sign(sponsor);
  await submit(trust, "trustline del sponsor");

  const iacc = await server.loadAccount(issuer.publicKey());
  const pay = new TransactionBuilder(iacc, { fee: BASE_FEE, networkPassphrase: NET })
    .addOperation(Operation.payment({
      destination: sponsor.publicKey(), asset: USDC, amount: "1000",
    }))
    .setTimeout(60).build();
  pay.sign(issuer);
  await submit(pay, "emisión de 1000 USDC al sponsor");

  save({
    issuer: issuer.secret(), sponsor: sponsor.secret(), recipient: recipient.secret(),
    issuerPub: issuer.publicKey(), sponsorPub: sponsor.publicKey(), recipientPub: recipient.publicKey(),
  });

  log("\nEstado guardado en spike-state.json");
  log("  sponsor  ", sponsor.publicKey());
  log("  recipient", recipient.publicKey(), "(sin fondear — a propósito)");
}

/* ── 2. sponsor ───────────────────────────────────────────────────────────
   Una sola transacción: crear la cuenta del receptor con 0 XLM y darle
   trustline de USDC, todo con reservas pagadas por el sponsor.
   Firma doble: sponsor (source) + recipient (para endSponsoring y changeTrust). */
async function sponsorAccount() {
  const s = load();
  const sponsor = Keypair.fromSecret(s.sponsor);
  const recipient = Keypair.fromSecret(s.recipient);
  const USDC = new Asset("USDC", s.issuerPub);

  const acc = await server.loadAccount(sponsor.publicKey());
  const tx = new TransactionBuilder(acc, { fee: BASE_FEE, networkPassphrase: NET })
    .addOperation(Operation.beginSponsoringFutureReserves({
      sponsoredId: recipient.publicKey(),
    }))
    .addOperation(Operation.createAccount({
      destination: recipient.publicKey(),
      startingBalance: "0", // ← cero XLM: la reserva la cubre el patrocinio
    }))
    .addOperation(Operation.changeTrust({
      asset: USDC, source: recipient.publicKey(),
    }))
    .addOperation(Operation.endSponsoringFutureReserves({
      source: recipient.publicKey(),
    }))
    .setTimeout(60).build();

  tx.sign(sponsor, recipient);
  await submit(tx, "cuenta + trustline patrocinadas (receptor con 0 XLM)");
}

/* ── 3. create ────────────────────────────────────────────────────────────
   Claimable balance con dos claimants:
     receptor  → puede reclamar ANTES de la expiración
     sponsor   → puede reclamar SOLO DESPUÉS (recuperación)
   La reserva del balance también va patrocinada.                            */
async function create(amount = "50", seconds = 300) {
  const s = load();
  const sponsor = Keypair.fromSecret(s.sponsor);
  const recipient = Keypair.fromSecret(s.recipient);
  const USDC = new Asset("USDC", s.issuerPub);

  const deadline = Math.floor(Date.now() / 1000) + seconds;
  const before = Claimant.predicateBeforeAbsoluteTime(String(deadline));

  const claimants = [
    new Claimant(recipient.publicKey(), before),
    new Claimant(sponsor.publicKey(), Claimant.predicateNot(before)),
  ];

  const acc = await server.loadAccount(sponsor.publicKey());
  const tx = new TransactionBuilder(acc, { fee: BASE_FEE, networkPassphrase: NET })
    .addOperation(Operation.createClaimableBalance({
      asset: USDC, amount: String(amount), claimants,
    }))
    .setTimeout(60).build();
  tx.sign(sponsor);

  const res = await submit(tx, `claimable balance de ${amount} USDC (expira en ${seconds}s)`);
  const balanceId = tx.getClaimableBalanceId(0);

  save({ ...s, balanceId, deadline });
  log(`    balanceId ${balanceId}`);
  log(`    expira    ${new Date(deadline * 1000).toISOString()}`);
  return res;
}

/* ── 4. claim ─────────────────────────────────────────────────────────────
   EL PASO CRÍTICO. El receptor tiene 0 XLM y no puede pagar el fee.
   Solución: transacción interna firmada por el receptor, envuelta en un
   fee bump donde el sponsor paga. Así "el usuario no necesita XLM" es real. */
async function claim() {
  const s = load();
  const sponsor = Keypair.fromSecret(s.sponsor);
  const recipient = Keypair.fromSecret(s.recipient);

  const acc = await server.loadAccount(recipient.publicKey());
  const inner = new TransactionBuilder(acc, { fee: BASE_FEE, networkPassphrase: NET })
    .addOperation(Operation.claimClaimableBalance({ balanceId: s.balanceId }))
    .setTimeout(120).build();
  inner.sign(recipient);

  const bump = TransactionBuilder.buildFeeBumpTransaction(
    sponsor, (Number(BASE_FEE) * 2).toString(), inner, NET,
  );
  bump.sign(sponsor);

  await submit(bump, "reclamo con fee bump (receptor sin XLM)");
}

/* ── 5. recover ───────────────────────────────────────────────────────────
   Después de la expiración, el sponsor recupera los fondos.                */
async function recover() {
  const s = load();
  const sponsor = Keypair.fromSecret(s.sponsor);
  const now = Math.floor(Date.now() / 1000);

  if (now < s.deadline) {
    log(`Todavía no expira. Faltan ${s.deadline - now}s.`);
    log("Esperá y volvé a correr. Debe fallar antes de la expiración.");
  }

  const acc = await server.loadAccount(sponsor.publicKey());
  const tx = new TransactionBuilder(acc, { fee: BASE_FEE, networkPassphrase: NET })
    .addOperation(Operation.claimClaimableBalance({ balanceId: s.balanceId }))
    .setTimeout(60).build();
  tx.sign(sponsor);

  await submit(tx, "recuperación por el emisor tras expirar");
}

async function status() {
  const s = load();
  for (const [label, pub] of [["sponsor", s.sponsorPub], ["recipient", s.recipientPub]]) {
    try {
      const a = await server.loadAccount(pub);
      log(`\n${label}  ${pub}`);
      a.balances.forEach((b) =>
        log(`   ${(b.asset_code ?? "XLM").padEnd(6)} ${b.balance}`));
      log(`   subentries: ${a.subentry_count}  sponsoring: ${a.num_sponsoring ?? 0}  sponsored: ${a.num_sponsored ?? 0}`);
    } catch {
      log(`\n${label}  ${pub}  — la cuenta no existe todavía`);
    }
  }
  if (s.balanceId) {
    try {
      const cb = await server.claimableBalances().claimableBalance(s.balanceId).call();
      log(`\nclaimable balance ${cb.amount} ${cb.asset.split(":")[0]}  claimants: ${cb.claimants.length}`);
    } catch {
      log(`\nclaimable balance — ya no existe (reclamado o recuperado)`);
    }
  }
}

const [cmd, arg] = process.argv.slice(2);
const run = {
  setup,
  sponsor: sponsorAccount,
  create: () => create(arg ?? "50", 300),
  "create-short": () => create(arg ?? "10", 90),
  claim,
  recover,
  status,
}[cmd];

if (!run) {
  log("comandos: setup | sponsor | create [monto] | claim | create-short | recover | status");
  process.exit(1);
}
run().catch((e) => { console.error("\nFALLÓ:", e.message); process.exit(1); });