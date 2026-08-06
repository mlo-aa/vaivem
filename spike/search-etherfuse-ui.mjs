/**
 * Search Etherfuse frontend bundles for order-page payment UI hints.
 */
const chunks = [
  "https://sandbox.etherfuse.com/_next/static/chunks/pages/ramp/order/%5Bid%5D-7abdd530dfea6edd-d18570642b07.js",
  "https://sandbox.etherfuse.com/_next/static/chunks/pages/_app-a7404e7f1b53e8ae-d18570642b07.js",
  "https://sandbox.etherfuse.com/_next/static/chunks/3745-593ffa338728ce43-d18570642b07.js",
  "https://sandbox.etherfuse.com/_next/static/chunks/5137-72c5a56880f4e832-d18570642b07.js",
]

const needles = [
  "copia",
  "Copia",
  "PIX",
  "pix",
  "QRCode",
  "qrcode",
  "statusPage",
  "brCode",
  "emv",
  "sandbox.etherfuse.com",
  "api.sand.etherfuse.com",
  "ramp/order",
]

for (const url of chunks) {
  const r = await fetch(url)
  const t = await r.text()
  console.log("\n===", url.split("/").pop(), "len", t.length, "===")
  for (const n of needles) {
    const i = t.indexOf(n)
    if (i >= 0) {
      console.log(n, ":", t.slice(Math.max(0, i - 60), i + 100).replace(/\s+/g, " "))
    }
  }
}
