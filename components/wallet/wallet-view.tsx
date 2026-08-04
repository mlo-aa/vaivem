"use client"

import { useState } from "react"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Copy,
  Gift,
  RotateCcw,
  Send,
  ShieldCheck,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { formatBRL, formatUSDC, maskStellarAddress, relativeTime } from "@/lib/format"
import { wallet, walletActivity } from "@/lib/mock-data"
import type { WalletActivity } from "@/lib/types"

const ICON: Record<WalletActivity["type"], typeof Gift> = {
  claim: Gift,
  received: ArrowDownLeft,
  sent: ArrowUpRight,
  refund: RotateCcw,
  withdrawal: ArrowUpRight,
}

export function WalletView() {
  const [copied, setCopied] = useState(false)

  function copyAddress() {
    navigator.clipboard.writeText(wallet.stellarAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const balanceBRL = wallet.usdcBalance * 5.045

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      {/* Balance card */}
      <Card className="overflow-hidden border-none bg-primary text-primary-foreground">
        <CardContent className="flex flex-col gap-4 py-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-primary-foreground/70">Your USDC balance</span>
            {wallet.sponsored ? (
              <Badge className="border-none bg-brand/20 text-brand-foreground">
                <ShieldCheck data-icon="inline-start" />
                Gas-free
              </Badge>
            ) : null}
          </div>
          <div>
            <p className="font-mono text-4xl font-semibold tracking-tight">
              {formatUSDC(wallet.usdcBalance)}
            </p>
            <p className="mt-1 text-sm text-primary-foreground/70">
              ≈ {formatBRL(balanceBRL)}
            </p>
          </div>
          <button
            type="button"
            onClick={copyAddress}
            className="flex items-center justify-between gap-2 rounded-lg bg-primary-foreground/10 px-3 py-2 text-left text-sm transition-colors hover:bg-primary-foreground/15"
          >
            <span className="font-mono text-primary-foreground/90">
              {maskStellarAddress(wallet.stellarAddress)}
            </span>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </button>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" size="lg">
          <Send data-icon="inline-start" />
          Send
        </Button>
        <Button size="lg">
          <ArrowDownLeft data-icon="inline-start" />
          Cash out
        </Button>
      </div>

      {/* Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col">
          {walletActivity.map((a, i) => {
            const Icon = ICON[a.type]
            const positive = a.amount >= 0
            return (
              <div key={a.id}>
                {i > 0 ? <Separator /> : null}
                <div className="flex items-center gap-3 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{a.label}</p>
                    <p className="text-xs text-muted-foreground">{relativeTime(a.timestamp)}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-sm font-medium tabular-nums"
                      data-positive={positive}
                      style={{ color: positive ? "var(--brand)" : "var(--foreground)" }}
                    >
                      {positive ? "+" : "−"}
                      {formatUSDC(Math.abs(a.amount)).replace(" USDC", "")}
                    </p>
                    <p className="text-xs text-muted-foreground">USDC</p>
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground text-pretty">
        This is a non-custodial embedded wallet secured on Stellar. ClaimLink sponsors network
        fees so you never need to hold gas tokens.
      </p>
    </div>
  )
}
