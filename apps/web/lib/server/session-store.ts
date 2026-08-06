/**
 * Persist sender users + session tokens in KV (or memory).
 * Users keyed as user:{email}. Sessions as session:{token}.
 */

import "server-only"

import { kv } from "@vercel/kv"
import { normalizeEmail } from "@/lib/dashboard-session"

const SESSION_PREFIX = "session:"
const USER_PREFIX = "user:"
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7

export interface StoredSession {
  sessionToken: string
  userId: string
  email: string
  expiresAt: string
  createdAt: string
}

export interface StoredUser {
  id: string
  email: string
  name: string | null
  createdAt: string
  updatedAt: string
}

const memorySessions = new Map<string, StoredSession>()
const memoryUsers = new Map<string, StoredUser>()

function kvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

function sessionKey(token: string) {
  return `${SESSION_PREFIX}${token}`
}

/** user:{email} — email is the stable owner id. */
function userKey(email: string) {
  return `${USER_PREFIX}${normalizeEmail(email)}`
}

function ttlSeconds(expiresAt: string): number {
  const ttl = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
  return Math.max(ttl, 60)
}

export const sessionStore = {
  async getOrCreateUser(email: string): Promise<StoredUser> {
    const e = normalizeEmail(email)
    const existing = await this.getUserByEmail(e)
    if (existing) return existing
    const now = new Date().toISOString()
    const record: StoredUser = {
      id: e,
      email: e,
      name: e.split("@")[0] ?? e,
      createdAt: now,
      updatedAt: now,
    }
    if (kvConfigured()) {
      await kv.set(userKey(e), record)
    } else {
      memoryUsers.set(e, record)
    }
    return record
  },

  async getUserByEmail(email: string): Promise<StoredUser | null> {
    const e = normalizeEmail(email)
    if (kvConfigured()) {
      return (await kv.get<StoredUser>(userKey(e))) ?? null
    }
    return memoryUsers.get(e) ?? null
  },

  async saveSession(session: StoredSession): Promise<void> {
    if (kvConfigured()) {
      await kv.set(sessionKey(session.sessionToken), session, {
        ex: ttlSeconds(session.expiresAt),
      })
      return
    }
    memorySessions.set(session.sessionToken, session)
  },

  async getSession(sessionToken: string): Promise<StoredSession | null> {
    if (kvConfigured()) {
      return (await kv.get<StoredSession>(sessionKey(sessionToken))) ?? null
    }
    return memorySessions.get(sessionToken) ?? null
  },

  async deleteSession(sessionToken: string): Promise<void> {
    if (kvConfigured()) {
      await kv.del(sessionKey(sessionToken))
      return
    }
    memorySessions.delete(sessionToken)
  },
}

export { DEFAULT_TTL_SECONDS }
