import { Keypair, Horizon, TransactionBuilder, Operation, Asset, Networks, BASE_FEE } from "@stellar/stellar-sdk";
import fs from "node:fs";

const server = new Horizon.Server("https://horizon-testnet.stellar.org");
const s = JSON.parse(fs.readFileSync("./spike-state.json"));
const sponsor = Keypair.fromSecret(s.sponsor);

const EF_USDC = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");

const acc = await server.loadAccount(sponsor.publicKey());
const tx = new TransactionBuilder(acc, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.changeTrust({ asset: EF_USDC }))
  .setTimeout(60).build();
tx.sign(sponsor);

const res = await server.submitTransaction(tx);
console.log("trustline creada:", res.hash);