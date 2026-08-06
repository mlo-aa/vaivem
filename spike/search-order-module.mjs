const url =
  "https://sandbox.etherfuse.com/_next/static/chunks/pages/_app-a7404e7f1b53e8ae-d18570642b07.js"
const t = await fetch(url).then((r) => r.text())

for (const term of [
  "getOrderPublic",
  "stpProxyClabe",
  "bankingAccountLabel",
  "orderCurrency",
  "81209",
  "Order Details",
  "Return to Orders",
  "Simulate",
  "Mark fiat",
  "fiatReceived",
  "Pix QR",
  "Pix payment",
  "copia e cola",
  "Copia e cola",
  "brCode",
  "pixCode",
  "qrCode",
  "QR code",
  "payment QR",
]) {
  const i = t.indexOf(term)
  if (i >= 0) {
    console.log(`\n=== ${term} ===`)
    console.log(t.slice(Math.max(0, i - 150), i + 600).replace(/\s+/g, " "))
  }
}
