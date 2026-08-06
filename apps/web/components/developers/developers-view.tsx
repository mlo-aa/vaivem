"use client"

import { useState } from "react"
import { Check, Copy, Play, Terminal } from "lucide-react"
import { useTranslations } from "next-intl"

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
  const t = useTranslations("developers")
  const tc = useTranslations("common")
  const [amount, setAmount] = useState("500")
  const [response, setResponse] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const endpoints = [
    { method: "POST", path: "/v1/claims", desc: t("epCreate") },
    { method: "GET", path: "/v1/claims/{id}", desc: t("epGet") },
    { method: "POST", path: "/v1/claims/batch", desc: t("epBatch") },
    { method: "POST", path: "/v1/webhooks", desc: t("epWebhooks") },
  ]

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
      <Card>
        <CardHeader>
          <CardTitle>{t("apiTitle")}</CardTitle>
          <CardDescription>{t("apiBody")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col">
          {endpoints.map((e, i) => (
            <div
              key={e.path}
              className="flex items-center gap-3 border-transparent py-3 dark:border-border data-[first=false]:border-t"
              data-first={i === 0}
            >
              <Badge
                variant={e.method === "GET" ? "secondary" : "default"}
                className="w-14 justify-center font-mono text-xs"
              >
                {e.method}
              </Badge>
              <code className="font-mono text-sm text-foreground">{e.path}</code>
              <span className="ml-auto hidden text-sm text-muted-foreground sm:block">
                {e.desc}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">{t("quickstart")}</CardTitle>
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
                  copyLabel={tc("copy")}
                />
              </TabsContent>
              <TabsContent value="node">
                <CodeBlock
                  code={NODE}
                  copied={copied === "node"}
                  onCopy={() => copy("node", NODE)}
                  copyLabel={tc("copy")}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Terminal className="size-4 text-foreground" />
              {t("playground")}
            </CardTitle>
            <CardDescription>{t("playgroundBody")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="pg-amount">{t("amountBrl")}</FieldLabel>
              <Input
                id="pg-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-mono"
              />
            </Field>
            <Button onClick={run} disabled={running}>
              <Play data-icon="inline-start" />
              {running ? t("sending") : t("sendTest")}
            </Button>
            {response ? (
              <pre className="max-h-64 overflow-auto rounded-[1.25rem] bg-foreground p-4 font-mono text-xs leading-relaxed text-background">
                {response}
              </pre>
            ) : (
              <div className="rounded-[1.25rem] bg-surface p-4 text-center text-sm text-muted-foreground dark:border dark:border-dashed dark:border-border">
                {t("responsePlaceholder")}
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
  copyLabel,
}: {
  code: string
  copied: boolean
  onCopy: () => void
  copyLabel: string
}) {
  return (
    <div className="relative mt-3">
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute right-2 top-2 text-background hover:bg-background/10 hover:text-background"
        onClick={onCopy}
        aria-label={copyLabel}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
      <pre className="max-h-80 overflow-auto rounded-[1.25rem] bg-foreground p-4 font-mono text-xs leading-relaxed text-background">
        {code}
      </pre>
    </div>
  )
}
