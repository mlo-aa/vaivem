import { Keypair, Horizon, TransactionBuilder, Operation, Asset, Networks, BASE_FEE, Memo } from "@stellar/stellar-sdk";
import fs from "node:fs";

const server = new Horizon.Server("https://horizon-testnet.stellar.org");
const s = JSON.parse(fs.readFileSync("./spike-state.json"));
const sponsor = Keypair.fromSecret(s.sponsor);

const EF_USDC = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");

const ANCHOR = "GCUX6U4F5675FBA5LSVFCL7HGMRTMTXB4U2WSM5ZLUE4ORIHS6XNXY3X";
const MEMO_B64 = "NUS7uWDyQqqRE2W2vikULAAAAAAAAAAAAAAAAAAAAAA=";
const AMOUNT = "20";

// El memo viene en base64 y es de tipo hash: hay que pasarlo a Buffer de 32 bytes.
const memo = Memo.hash(Buffer.from(MEMO_B64, "base64"));

const acc = await server.loadAccount(sponsor.publicKey());
const tx = new TransactionBuilder(acc, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.payment({ destination: ANCHOR, asset: EF_USDC, amount: AMOUNT }))
  .addMemo(memo)
  .setTimeout(120)
  .build();

tx.sign(sponsor);

try {
  const res = await server.submitTransaction(tx);
  console.log("enviado:", res.hash);
  console.log("https://stellar.expert/explorer/testnet/tx/" + res.hash);
} catch (e) {
  console.log(JSON.stringify(e?.response?.data?.extras?.result_codes ?? e.message, null, 2));
}