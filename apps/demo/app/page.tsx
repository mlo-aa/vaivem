"use client"

import { RampWithdraw } from "@vaivem/react"

/** Freelancer marketplace payout — imports the Vaivém kit. */
export default function PayInvoicePage() {
  return (
    <main style={{ maxWidth: 480, margin: "3rem auto", padding: "0 1rem" }}>
      <p style={{ letterSpacing: ".12em", textTransform: "uppercase", fontSize: 12, color: "#0f766e" }}>Fieldwork · Invoice #FW-1842</p>
      <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 500, fontSize: "2rem" }}>Pay Camila for brand illustration</h1>
      <p style={{ color: "#4b5563", marginBottom: "1.5rem" }}>120 USDC escrowed — cash out to PIX, no wallet needed.</p>
      <RampWithdraw amount={120} country="BR" onPaid={() => console.log("paid")} />
    </main>
  )
}
