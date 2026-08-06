/**
 * Persist sender user records in KV (or memory).
 * Users keyed as user:{email}. Auth is the HMAC cookie — not session KV rows.
 */

import "server-only"

import { kv } from "@vercel/kv"
import { normalizeEmail } from "@/lib/dashboard-session"

const USER_PREFIX = "user:"

export interface StoredUser {
  id: string
  email: string
  name: string | null
  createdAt: string
  updatedAt: string
}

const memoryUsers = new Map<string, StoredUser>()

function kvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

function userKey(email: string) {
  return `${USER_PREFIX}${normalizeEmail(email)}`
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
}
