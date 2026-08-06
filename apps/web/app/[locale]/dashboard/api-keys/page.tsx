'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Copy, Check, KeyRound, Trash2 } from 'lucide-react'
import { DashboardTopbar } from '@/components/dashboard/dashboard-topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { toast } from 'sonner'

type ApiKeyRow = {
  id: string
  name: string
  prefix: string
  createdAt: string
  revokedAt: string | null
  lastUsedAt: string | null
}

export default function ApiKeysPage() {
  const t = useTranslations('apiKeys')
  const tCommon = useTranslations('common')
  const [keys, setKeys] = useState<ApiKeyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/api-keys')
      if (!res.ok) throw new Error('load_failed')
      const data = (await res.json()) as { keys: ApiKeyRow[] }
      setKeys(data.keys)
    } catch {
      toast.error(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setCreating(true)
    setNewSecret(null)
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || t('defaultName') }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? t('createError'))
        return
      }
      setNewSecret(String(data.secret))
      setName('')
      await load()
      toast.success(t('created'))
    } catch {
      toast.error(t('createError'))
    } finally {
      setCreating(false)
    }
  }

  async function onRevoke(id: string) {
    if (!window.confirm(t('revokeConfirm'))) return
    try {
      const res = await fetch(`/api/api-keys?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        toast.error(t('revokeError'))
        return
      }
      setKeys((prev) =>
        prev.map((k) =>
          k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k,
        ),
      )
      toast.success(t('revoked'))
    } catch {
      toast.error(t('revokeError'))
    }
  }

  async function copySecret() {
    if (!newSecret) return
    try {
      await navigator.clipboard.writeText(newSecret)
      setCopied(true)
      toast.success(t('copied'))
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error(t('copyError'))
    }
  }

  const active = keys.filter((k) => !k.revokedAt)
  const revoked = keys.filter((k) => k.revokedAt)

  return (
    <>
      <DashboardTopbar title={t('title')} />
      <main className="flex-1 space-y-6 px-4 pb-10 sm:px-8">
        <p className="max-w-2xl text-[15px] text-muted-foreground">{t('subtitle')}</p>

        <Card>
          <CardHeader>
            <CardTitle>{t('createTitle')}</CardTitle>
            <CardDescription>{t('createBody')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <label htmlFor="key-name" className="text-sm font-medium">
                  {t('nameLabel')}
                </label>
                <Input
                  id="key-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('namePlaceholder')}
                />
              </div>
              <Button type="submit" disabled={creating}>
                <KeyRound data-icon="inline-start" />
                {creating ? t('creating') : t('create')}
              </Button>
            </form>

            {newSecret ? (
              <div className="mt-4 space-y-2 rounded-[1.25rem] bg-primary p-4 text-primary-foreground">
                <p className="text-sm font-medium">{t('secretOnce')}</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <code className="flex-1 break-all font-mono text-sm">{newSecret}</code>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={() => void copySecret()}
                  >
                    {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
                    {tCommon('copy')}
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('listTitle')}</CardTitle>
            <CardDescription>{t('listBody')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>
            ) : active.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
            ) : (
              active.map((key) => (
                <div
                  key={key.id}
                  className="flex flex-col gap-3 rounded-[1.25rem] bg-background p-4 sm:flex-row sm:items-center sm:justify-between dark:border dark:border-border"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{key.name}</p>
                    <p className="mt-0.5 font-mono text-sm text-muted-foreground">
                      {key.prefix}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('createdAt', {
                        date: new Date(key.createdAt).toLocaleString(),
                      })}
                      {key.lastUsedAt
                        ? ` · ${t('lastUsed', {
                            date: new Date(key.lastUsedAt).toLocaleString(),
                          })}`
                        : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void onRevoke(key.id)}
                  >
                    <Trash2 data-icon="inline-start" />
                    {t('revoke')}
                  </Button>
                </div>
              ))
            )}

            {revoked.length > 0 ? (
              <div className="pt-2">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('revokedSection')}
                </p>
                {revoked.map((key) => (
                  <div
                    key={key.id}
                    className="mb-2 rounded-[1.25rem] bg-surface px-4 py-3 opacity-60 dark:border dark:border-border"
                  >
                    <p className="text-sm font-medium">{key.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{key.prefix}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('usageTitle')}</CardTitle>
            <CardDescription>{t('usageBody')}</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-[1.25rem] bg-foreground p-4 font-mono text-xs leading-relaxed text-background">
{`curl ${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/claims \\
  -H "Authorization: Bearer sk_test_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": "10",
    "currency": "BRL",
    "recipient": { "name": "Ana", "email": "ana@example.com" },
    "protection": "email"
  }'`}
            </pre>
            <p className="mt-3 text-sm text-muted-foreground">{t('amountHint')}</p>
          </CardContent>
        </Card>
      </main>
    </>
  )
}
