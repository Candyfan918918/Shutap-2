// Client-side interaction gate. Any action that WRITES to the backend
// (spill, scan save, comment, react, relate, alias mint, subscribe) must
// call requireRealUser({ intent }) before proceeding. Anonymous or missing
// sessions get their intent captured and are redirected to /welcome; the
// welcome flow resumes the intent after login.
import { supabase } from '@/integrations/supabase/client'
import { getRouterRef } from '@/lib/router-ref'

export type PendingIntent =
  | { kind: 'spill' }
  | { kind: 'scan' }
  | { kind: 'comment'; roomId: string }
  | { kind: 'relate'; roomId: string }
  | { kind: 'react'; roomId: string; reaction?: string }
  | { kind: 'subscribe' }
  | { kind: 'custom'; url: string }

const INTENT_KEY = 'shutap_pending_intent'
const RETURN_KEY = 'shutap_returnTo'

// An intent older than this is treated as abandoned. Magic-link sign-ins
// complete well inside this window; anything older is a stale tab that
// would otherwise replay (e.g. open the scan modal) on an unrelated login.
const INTENT_MAX_AGE_MS = 60 * 60 * 1000

export function saveIntent(intent: PendingIntent): void {
  try {
    sessionStorage.setItem(INTENT_KEY, JSON.stringify({ ...intent, at: Date.now() }))
    sessionStorage.setItem(RETURN_KEY, window.location.href)
  } catch { /* noop */ }
}

/** Read the pending intent. Drops (and clears) malformed or expired entries. */
export function readIntent(): PendingIntent | null {
  try {
    const raw = sessionStorage.getItem(INTENT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as (PendingIntent & { at?: number }) | null
    if (!parsed || typeof parsed !== 'object' || typeof parsed.kind !== 'string') { clearIntent(); return null }
    if (typeof parsed.at === 'number' && Date.now() - parsed.at > INTENT_MAX_AGE_MS) { clearIntent(); return null }
    const { at: _at, ...intent } = parsed
    return intent as PendingIntent
  } catch { clearIntent(); return null }
}

export function clearIntent(): void {
  try { sessionStorage.removeItem(INTENT_KEY) } catch { /* noop */ }
}

/** Forget everything captured for a sign-in that the user walked away from. */
export function clearPendingAuthReturn(): void {
  try {
    sessionStorage.removeItem(INTENT_KEY)
    sessionStorage.removeItem(RETURN_KEY)
  } catch { /* noop */ }
}

/* ── the durable return ──
   RETURN_KEY is sessionStorage, which is per tab: a magic link opened from
   the mail app lands in a fresh tab that has never heard of it, and /welcome
   falls through to the stream. Pages that send someone away to sign in and
   need them back — the paywall above all — also write the path here, in
   localStorage, with a short life so an old one never replays. */
const DURABLE_RETURN_KEY = 'shutap_returnTo_durable'
const DURABLE_RETURN_MAX_AGE_MS = 60 * 60 * 1000

export function setDurableReturn(path: string): void {
  try { localStorage.setItem(DURABLE_RETURN_KEY, JSON.stringify({ path, at: Date.now() })) } catch { /* noop */ }
}

/** Read and clear it. Only same-origin paths ever come back. */
export function takeDurableReturn(): string | null {
  try {
    const raw = localStorage.getItem(DURABLE_RETURN_KEY)
    if (!raw) return null
    localStorage.removeItem(DURABLE_RETURN_KEY)
    const parsed = JSON.parse(raw) as { path?: string; at?: number } | null
    if (!parsed?.path || typeof parsed.at !== 'number') return null
    if (Date.now() - parsed.at > DURABLE_RETURN_MAX_AGE_MS) return null
    if (!parsed.path.startsWith('/') || parsed.path.startsWith('//')) return null
    return parsed.path
  } catch { return null }
}

// Module-level cache of whether we have a real (non-anonymous) signed-in user.
// null = unknown. Refreshed by onAuthStateChange so subsequent CTA clicks
// decide synchronously without awaiting getSession.
let cachedHasRealUser: boolean | null = null

if (typeof window !== 'undefined') {
  void supabase.auth.getSession().then(({ data }) => {
    const u = data.session?.user as { is_anonymous?: boolean } | undefined
    cachedHasRealUser = !!data.session && !u?.is_anonymous
  }).catch(() => { /* leave as null */ })
  supabase.auth.onAuthStateChange((_evt, session) => {
    const u = session?.user as { is_anonymous?: boolean } | undefined
    cachedHasRealUser = !!session && !u?.is_anonymous
  })
}

function navigateToWelcome(): void {
  const router = getRouterRef()
  if (router) router.navigate({ to: '/welcome' })
  else window.location.assign('/welcome')
}

/** Returns true if a real signed-in user is present. Otherwise captures the
 *  intent and redirects to /welcome. Uses a cached session flag so the common
 *  anonymous path is synchronous (no awaited network round-trip). */
export async function requireRealUser(intent: PendingIntent): Promise<boolean> {
  if (cachedHasRealUser === false) {
    saveIntent(intent)
    navigateToWelcome()
    return false
  }
  if (cachedHasRealUser === true) return true
  const { data } = await supabase.auth.getSession()
  const u = data.session?.user as { is_anonymous?: boolean } | undefined
  const real = !!data.session && !u?.is_anonymous
  cachedHasRealUser = real
  if (real) return true
  saveIntent(intent)
  navigateToWelcome()
  return false
}

/** Resolve a pending intent into a URL to bounce back to after auth. */
export function resolveIntentUrl(intent: PendingIntent): string {
  switch (intent.kind) {
    case 'spill': return '/#spill'
    case 'scan': return '/#scan'
    case 'comment':
    case 'relate':
    case 'react':
      return '/room?id=' + encodeURIComponent(intent.roomId)
    case 'subscribe': return '/subscribe'
    case 'custom': return intent.url
  }
}
