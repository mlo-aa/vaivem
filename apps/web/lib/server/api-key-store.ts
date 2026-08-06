/**
 * API keys for the public /api/v1 surface.
 * KV when configured; file store locally (same pattern as funding).
 *
 * Secret is shown once at creation. Only SHA-256 hashes are stored.
 */

import "server-only"

import { createHash, randomBytes } from "node:crypto"
import { kv } from "@vercel/kv"

import {
  fileGetApiKey,
  fileGetApiKeyByHash,
  fileListApiKeysByOwner,
  fileSaveApiKey,
  fileUpdateApiKey,
  type StoredApiKey,
} from "@/lib/server/api-key-file-store"

export type { StoredApiKey }

const KEY_PREFIX = "apikey:"
const HASH_PREFIX = "apikey-hash:"
const OWNER_PREFIX = "apikeys:owner:"

function kvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

function useFileStore(): boolean {
  return !kvConfigured()
}

function keyRecord(id: string) {
  return `${KEY_PREFIX}${id}`
}

function hashLookup(hash: string) {
  return `${HASH_PREFIX}${hash}`
}

function ownerIndex(ownerId: string) {
  return `${OWNER_PREFIX}${ownerId}`
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex")
}

function keyEnvPrefix(): "sk_live_" | "sk_test_" {
  return process.env.NODE_ENV === "production" ? "sk_live_" : "sk_test_"
}

function generateRawKey(): { raw: string; id: string; prefix: string } {
  const id = randomBytes(8).toString("hex")
  const secret = randomBytes(24).toString("base64url")
  const env = keyEnvPrefix()
  const raw = `${env}${id}_${secret}`
  const prefix = `${env}${id.slice(0, 4)}…`
  return { raw, id: `key_${id}`, prefix }
}

export type PublicApiKey = {
  id: string
  name: string
  prefix: string
  createdAt: string
  revokedAt: string | null
  lastUsedAt: string | null
}

function toPublic(key: StoredApiKey): PublicApiKey {
  return {
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    createdAt: key.createdAt,
    revokedAt: key.revokedAt,
    lastUsedAt: key.lastUsedAt,
  }
}

export async function createApiKey(
  ownerId: string,
  name: string,
): Promise<{ key: PublicApiKey; secret: string }> {
  const { raw, id, prefix } = generateRawKey()
  const now = new Date().toISOString()
  const record: StoredApiKey = {
    id,
    ownerId,
    name: name.trim() || "Default",
    prefix,
    keyHash: hashApiKey(raw),
    createdAt: now,
    revokedAt: null,
    lastUsedAt: null,
  }

  if (useFileStore()) {
    await fileSaveApiKey(record)
  } else {
    await kv.set(keyRecord(id), record)
    await kv.set(hashLookup(record.keyHash), id)
    await kv.sadd(ownerIndex(ownerId), id)
  }

  return { key: toPublic(record), secret: raw }
}

export async function listApiKeys(ownerId: string): Promise<PublicApiKey[]> {
  if (useFileStore()) {
    return (await fileListApiKeysByOwner(ownerId)).map(toPublic)
  }
  const ids = (await kv.smembers(ownerIndex(ownerId))) as string[]
  const keys = await Promise.all(
    ids.map(async (id) => (await kv.get<StoredApiKey>(keyRecord(id))) ?? null),
  )
  return keys
    .filter((k): k is StoredApiKey => Boolean(k))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toPublic)
}

export async function revokeApiKey(
  ownerId: string,
  keyId: string,
): Promise<PublicApiKey | null> {
  const existing = useFileStore()
    ? await fileGetApiKey(keyId)
    : await kv.get<StoredApiKey>(keyRecord(keyId))

  if (!existing || existing.ownerId !== ownerId) return null
  if (existing.revokedAt) return toPublic(existing)

  const updated: StoredApiKey = {
    ...existing,
    revokedAt: new Date().toISOString(),
  }

  if (useFileStore()) {
    await fileUpdateApiKey(updated)
  } else {
    await kv.set(keyRecord(keyId), updated)
  }
  return toPublic(updated)
}

export async function resolveApiKey(
  rawKey: string,
): Promise<{ ownerId: string; keyId: string } | null> {
  const trimmed = rawKey.trim()
  if (!trimmed.startsWith("sk_live_") && !trimmed.startsWith("sk_test_")) {
    return null
  }

  const keyHash = hashApiKey(trimmed)
  const record = useFileStore()
    ? await fileGetApiKeyByHash(keyHash)
    : await (async () => {
        const id = await kv.get<string>(hashLookup(keyHash))
        if (!id) return null
        return kv.get<StoredApiKey>(keyRecord(id))
      })()

  if (!record || record.revokedAt) return null

  const touched: StoredApiKey = {
    ...record,
    lastUsedAt: new Date().toISOString(),
  }
  if (useFileStore()) {
    await fileUpdateApiKey(touched)
  } else {
    await kv.set(keyRecord(record.id), touched)
  }

  return { ownerId: record.ownerId, keyId: record.id }
}
