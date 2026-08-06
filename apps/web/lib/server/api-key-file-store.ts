/**
 * File-backed API key store when KV is not configured (local dev).
 */

import "server-only"

import fs from "node:fs/promises"
import path from "node:path"

export type StoredApiKey = {
  id: string
  ownerId: string
  name: string
  /** First characters shown in the UI, e.g. sk_live_ab12… */
  prefix: string
  keyHash: string
  createdAt: string
  revokedAt: string | null
  lastUsedAt: string | null
}

type FileStoreSnapshot = {
  byId: Record<string, StoredApiKey>
  hashToId: Record<string, string>
  ownerIds: Record<string, string[]>
}

const DATA_DIR = path.join(process.cwd(), ".data")
const STORE_PATH = path.join(DATA_DIR, "api-keys-store.json")

let snapshot: FileStoreSnapshot | null = null
let writeChain: Promise<void> = Promise.resolve()

function emptySnapshot(): FileStoreSnapshot {
  return { byId: {}, hashToId: {}, ownerIds: {} }
}

async function loadSnapshot(): Promise<FileStoreSnapshot> {
  if (snapshot) return snapshot
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8")
    const parsed = JSON.parse(raw) as Partial<FileStoreSnapshot>
    snapshot = {
      byId: parsed.byId ?? {},
      hashToId: parsed.hashToId ?? {},
      ownerIds: parsed.ownerIds ?? {},
    }
  } catch {
    snapshot = emptySnapshot()
  }
  return snapshot
}

async function persistSnapshot(next: FileStoreSnapshot): Promise<void> {
  snapshot = next
  writeChain = writeChain.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.writeFile(STORE_PATH, JSON.stringify(next, null, 2), "utf8")
  })
  await writeChain
}

export async function fileGetApiKey(id: string): Promise<StoredApiKey | null> {
  const s = await loadSnapshot()
  return s.byId[id] ?? null
}

export async function fileGetApiKeyByHash(
  keyHash: string,
): Promise<StoredApiKey | null> {
  const s = await loadSnapshot()
  const id = s.hashToId[keyHash]
  if (!id) return null
  return s.byId[id] ?? null
}

export async function fileListApiKeysByOwner(
  ownerId: string,
): Promise<StoredApiKey[]> {
  const s = await loadSnapshot()
  const ids = s.ownerIds[ownerId] ?? []
  return ids
    .map((id) => s.byId[id])
    .filter((k): k is StoredApiKey => Boolean(k))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function fileSaveApiKey(key: StoredApiKey): Promise<void> {
  const s = await loadSnapshot()
  s.byId[key.id] = key
  s.hashToId[key.keyHash] = key.id
  const list = s.ownerIds[key.ownerId] ?? []
  if (!list.includes(key.id)) {
    s.ownerIds[key.ownerId] = [key.id, ...list]
  }
  await persistSnapshot(s)
}

export async function fileUpdateApiKey(key: StoredApiKey): Promise<void> {
  const s = await loadSnapshot()
  s.byId[key.id] = key
  await persistSnapshot(s)
}
