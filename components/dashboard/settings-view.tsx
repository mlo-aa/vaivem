"use client"

import { useState } from "react"
import { Check, Copy, Eye, EyeOff, Key, Plus, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { currentOrg, currentUser } from "@/lib/mock-data"

const API_KEYS = [
  { id: "1", label: "Production", value: "sk_live_a1b2c3d4e5f6g7h8i9j0", created: "Jan 12, 2025" },
  { id: "2", label: "Sandbox", value: "sk_test_z9y8x7w6v5u4t3s2r1q0", created: "Jan 12, 2025" },
]

export function SettingsView() {
  return (
    <Tabs defaultValue="organization" className="w-full">
      <TabsList>
        <TabsTrigger value="organization">Organization</TabsTrigger>
        <TabsTrigger value="branding">Branding</TabsTrigger>
        <TabsTrigger value="api">API keys</TabsTrigger>
      </TabsList>

      <TabsContent value="organization">
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
            <CardDescription>Details shown to recipients and on invoices.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="org-name">Company name</FieldLabel>
                <Input id="org-name" defaultValue={currentOrg.name} />
              </Field>
              <Field>
                <FieldLabel htmlFor="org-country">Country</FieldLabel>
                <Input id="org-country" defaultValue={currentOrg.country} />
              </Field>
              <Field>
                <FieldLabel htmlFor="org-owner">Account owner</FieldLabel>
                <Input id="org-owner" defaultValue={`${currentUser.name} · ${currentUser.email}`} disabled />
                <FieldDescription>Contact support to transfer ownership.</FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={() => toast.success("Organization settings saved")}>Save changes</Button>
          </CardFooter>
        </Card>
      </TabsContent>

      <TabsContent value="branding">
        <Card>
          <CardHeader>
            <CardTitle>Recipient branding</CardTitle>
            <CardDescription>Customize what recipients see when they claim a payout.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="accent">Accent color</FieldLabel>
                <div className="flex items-center gap-3">
                  <input
                    id="accent"
                    type="color"
                    defaultValue={currentOrg.branding.accentColor}
                    className="size-10 cursor-pointer rounded-md border border-border bg-transparent"
                  />
                  <Input defaultValue={currentOrg.branding.accentColor} className="w-32 font-mono" />
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="welcome">Welcome message</FieldLabel>
                <Textarea
                  id="welcome"
                  defaultValue={currentOrg.branding.recipientMessage}
                  className="min-h-24"
                />
                <FieldDescription>Shown above the claim amount.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="support">Support email</FieldLabel>
                <Input id="support" type="email" defaultValue={currentOrg.branding.supportEmail} />
              </Field>
              <Field orientation="horizontal">
                <Switch id="whitelabel" defaultChecked />
                <FieldLabel htmlFor="whitelabel">Remove ClaimLink branding</FieldLabel>
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={() => toast.success("Branding updated")}>Save branding</Button>
          </CardFooter>
        </Card>
      </TabsContent>

      <TabsContent value="api">
        <Card>
          <CardHeader>
            <CardTitle>API keys</CardTitle>
            <CardDescription>Use these to authenticate requests to the ClaimLink API.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {API_KEYS.map((k, i) => (
              <div key={k.id}>
                {i > 0 ? <Separator className="mb-3" /> : null}
                <ApiKeyRow label={k.label} value={k.value} created={k.created} />
              </div>
            ))}
          </CardContent>
          <CardFooter className="justify-between">
            <p className="text-xs text-muted-foreground">
              Keep keys secret. Rotate immediately if exposed.
            </p>
            <Button variant="outline" onClick={() => toast.success("New API key generated")}>
              <Plus data-icon="inline-start" />
              Create key
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>
    </Tabs>
  )
}

function ApiKeyRow({ label, value, created }: { label: string; value: string; created: string }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(value)
    setCopied(true)
    toast.success("API key copied")
    setTimeout(() => setCopied(false), 1600)
  }

  const masked = value.slice(0, 7) + "•".repeat(16)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Key className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{label}</span>
        <Badge variant={label === "Production" ? "default" : "secondary"} className="text-xs">
          {label === "Production" ? "Live" : "Test"}
        </Badge>
        <span className="ml-auto text-xs text-muted-foreground">Created {created}</span>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm text-foreground">
          {revealed ? value : masked}
        </code>
        <Button variant="outline" size="icon" onClick={() => setRevealed((r) => !r)} aria-label="Reveal key">
          {revealed ? <EyeOff /> : <Eye />}
        </Button>
        <Button variant="outline" size="icon" onClick={copy} aria-label="Copy key">
          {copied ? <Check /> : <Copy />}
        </Button>
        <Button variant="outline" size="icon" onClick={() => toast.success(`${label} key rotated`)} aria-label="Rotate key">
          <RefreshCw />
        </Button>
      </div>
    </div>
  )
}
