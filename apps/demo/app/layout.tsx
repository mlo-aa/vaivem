import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Fieldwork — Pay invoice",
  description: "Freelancer marketplace payout demo powered by Vaivém",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}