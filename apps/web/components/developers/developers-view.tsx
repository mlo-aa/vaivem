"use client"

import { useState } from "react"
import { Check, Copy, Play, Terminal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { mockApiResponse } from "@/lib/services"

const ENDPOINTS = [
  { method: "POST", path: "/v1/claims", desc: "Create and fund a claim link" },
  { method: "GET", path: "/v1/claims/{id}", desc: "Retrieve a claim's status" },
  { method: "POST", path: "/v1/claims/batch", desc: "Create claims in bulk" },
  { method: "POST", path: "/v1/webhooks", desc: "Subscribe to payout events" },
]

  const CURL = `curl https://api.vaivem.app/v1/claims \\
  -H "Authorization: Bearer sk_live_••••" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": "500",
    "currency": "BRL",
    "recipient": { "name": "Ana", "email": "ana@example.com" },
    "protection": "email"
  }'`

  const NODE = `import { Vaivem } from "@vaivem/node"

  const client = new Vaivem(process.env.VAIVEM_KEY)

const claim = await client.claims.create({
  amount: "500",
  currency: "BRL",
  recipient: { name: "Ana", email: "ana@example.com" },
  protection: "email",
})

console.log(claim.claimUrl)`

export function DevelopersView() {
  const [amount, setAmount] = useState("500")
  const [response, setResponse] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  function run() {
    setRunning(true)
    setResponse(null)
    setTimeout(() => {
      setResponse(JSON.stringify(mockApiResponse(amount), null, 2))
      setRunning(false)
    }, 700)
  }

  function copy(id: string, text: string) {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 1600)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle>REST API</CardTitle>
          <CardDescription>
            A single integration for payouts across 30+ currencies. Funds settle on Stellar; recipients
            never need a wallet.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col">
          {ENDPOINTS.map((e, i) => (
            <div
              key={e.path}
              className="flex items-center gap-3 border-border py-3 data-[first=false]:border-t"
              data-first={i === 0}
            >
              <Badge
                variant={e.method === "GET" ? "secondary" : "default"}
                className="w-14 justify-center font-mono text-xs"
              >
                {e.method}
              </Badge>
              <code className="font-mono text-sm text-foreground">{e.path}</code>
              <span className="ml-auto hidden text-sm text-muted-foreground sm:block">{e.desc}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Code samples */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Quickstart</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="curl">
              <TabsList>
                <TabsTrigger value="curl">cURL</TabsTrigger>
                <TabsTrigger value="node">Node.js</TabsTrigger>
              </TabsList>
              <TabsContent value="curl">
                <CodeBlock
                  code={CURL}
                  copied={copied === "curl"}
                  onCopy={() => copy("curl", CURL)}
                />
              </TabsContent>
              <TabsContent value="node">
                <CodeBlock
                  code={NODE}
                  copied={copied === "node"}
                  onCopy={() => copy("node", NODE)}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Playground */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Terminal className="size-4 text-brand" />
              Try it live
            </CardTitle>
            <CardDescription>Send a test request against the sandbox.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="pg-amount">Amount (BRL)</FieldLabel>
              <Input
                id="pg-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-mono"
              />
            </Field>
            <Button onClick={run} disabled={running}>
              <Play data-icon="inline-start" />
              {running ? "Sending…" : "Send test request"}
            </Button>
            {response ? (
              <pre className="max-h-64 overflow-auto rounded-lg bg-primary p-4 font-mono text-xs leading-relaxed text-primary-foreground">
                {response}
              </pre>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                Response will appear here
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function CodeBlock({
  code,
  copied,
  onCopy,
}: {
  code: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div className="relative mt-3">
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute right-2 top-2 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
        onClick={onCopy}
        aria-label="Copy code"
      >
        {copied ? <Check /> : <Copy />}
      </Button>
      <pre className="max-h-80 overflow-auto rounded-lg bg-primary p-4 font-mono text-xs leading-relaxed text-primary-foreground">
        {code}
      </pre>
    </div>
  )
}
