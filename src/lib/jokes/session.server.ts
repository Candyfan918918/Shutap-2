// Optional-identity resolution for the joke-card surface.
//
// The landing surface must work for a signed-out visitor, so it cannot use
// `requireSupabaseAuth` (which throws 401). Instead every joke server fn
// resolves identity here: a valid bearer token wins, otherwise the caller is
// a guest keyed by their browser session id. A client claiming a tier gains
// nothing — the tier is derived from the token and the subscriptions table.
import { getRequest } from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'

type SupabaseAdmin = {
  from: (table: string) => any
}

export type JokeIdentity = {
  userId: string | null
  isAnonymousUser: boolean
  tier: 'guest' | 'free' | 'paying'
  subjectKey: string
}

function publishableClient(token?: string) {
  const url = process.env['SUPABASE_URL']!
  const key = process.env['SUPABASE_PUBLISHABLE_KEY']!
  return createClient<Database>(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers)
        if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) {
          headers.delete('Authorization')
        }
        headers.set('apikey', key)
        if (token) headers.set('Authorization', `Bearer ${token}`)
        return fetch(input, { ...init, headers })
      },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  })
}

function bearer(): string | null {
  try {
    const req = getRequest()
    const header = req?.headers?.get('authorization')
    if (!header || !header.startsWith('Bearer ')) return null
    const token = header.slice(7)
    return token && token.split('.').length === 3 ? token : null
  } catch {
    return null
  }
}

/** Resolve who is calling, and what they are entitled to, server-side. */
export async function resolveJokeIdentity(anonSessionId: string | null): Promise<JokeIdentity> {
  // The header set by the client middleware is the canonical carrier; the
  // argument stays as a fallback. Either way it is untrusted, tier-free input.
  let headerAnon = ''
  try {
    headerAnon = getRequest()?.headers?.get('x-shutap-anon') ?? ''
  } catch {
    headerAnon = ''
  }
  const anon = (headerAnon || anonSessionId || '').slice(0, 64)

  const guest: JokeIdentity = {
    userId: null,
    isAnonymousUser: false,
    tier: 'guest',
    subjectKey: 'anon:' + (anon || 'unknown'),
  }

  const token = bearer()
  if (!token) return guest

  try {
    const client = publishableClient(token)
    let sub: string | undefined
    let isAnon = false
    const { data, error } = await client.auth.getClaims(token)
    const claims = data?.claims as { sub?: string; is_anonymous?: boolean } | undefined
    if (!error && claims?.sub) {
      sub = claims.sub
      isAnon = !!claims.is_anonymous
    } else {
      // Local JWT verification can fail (key rotation, asymmetric keys, clock
      // skew). Fall back to asking Supabase Auth directly before giving up.
      const { data: userData, error: userErr } = await client.auth.getUser(token)
      if (userErr || !userData?.user) return guest
      sub = userData.user.id
      isAnon = userData.user.is_anonymous === true
    }
    if (!sub) return guest
    // A Supabase anonymous user is not a signed-in person for our tiers.
    if (isAnon) return guest

    const userId = sub

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const env = process.env['STRIPE_LIVE_API_KEY'] ? 'live' : 'sandbox'
    const { data: paying } = await supabaseAdmin.rpc('has_active_mirror', {
      user_uuid: userId,
      check_env: env,
    })

    return {
      userId,
      isAnonymousUser: false,
      tier: paying ? 'paying' : 'free',
      subjectKey: 'user:' + userId,
    }
  } catch {
    return guest
  }
}

/**
 * The caller's calendar day, derived ONLY from server-stored state.
 *
 * A client-supplied timezone is never trusted: flipping it would roll the day
 * over and farm extra flips. Signed-in visitors use the timezone stored on
 * their alias row; if it is missing we resolve to UTC and store that on first
 * use. Guests have no stored row, so they are always on UTC.
 */
export async function resolveDay(admin: SupabaseAdmin, userId: string | null): Promise<string> {
  return (await resolveDayInfo(admin, userId)).day
}

/** The day, the timezone it was read in, and the instant it rolls over. */
export async function resolveDayInfo(
  admin: SupabaseAdmin,
  userId: string | null,
): Promise<{ day: string; tz: string; resetsAt: string }> {
  let tz = 'UTC'
  if (userId) {
    try {
      const { data } = await admin
        .from('aliases')
        .select('timezone')
        .eq('user_id', userId)
        .maybeSingle()
      const stored = (data?.timezone as string | undefined)?.trim()
      if (stored) {
        tz = stored
      } else if (data) {
        // store the resolved value on first use so it cannot drift per request
        await admin.from('aliases').update({ timezone: 'UTC' } as never).eq('user_id', userId)
      }
    } catch { /* UTC */ }
  }
  const day = dayIn(tz)
  return { day, tz, resetsAt: nextResetAt(day, tz) }
}

/** Wall-clock offset of `tz` at `date`, in ms. */
function tzOffsetMs(date: Date, tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(date)
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
    return asUtc - Math.floor(date.getTime() / 1000) * 1000
  } catch {
    return 0
  }
}

/** Midnight after `day` (YYYY-MM-DD) in `tz`, as an ISO instant. */
export function nextResetAt(day: string, tz: string): string {
  const [y, m, d] = day.split('-').map(Number)
  if (!y || !m || !d) return new Date(Date.now() + 24 * 3600 * 1000).toISOString()
  const naive = Date.UTC(y, m - 1, d + 1)
  return new Date(naive - tzOffsetMs(new Date(naive), tz)).toISOString()
}

function dayIn(tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

/**
 * A coarse per-IP abuse layer, separate from the tier rules. The guest session
 * id clears in one keystroke, so it cannot be the only throttle. Tunable with
 * JOKE_IP_FLIPS_PER_DAY.
 */
export function ipFlipLimit(): number {
  const raw = Number(process.env['JOKE_IP_FLIPS_PER_DAY'] ?? '20')
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 20
}

/** Stable, non-reversible subject key for the caller's network address. */
export function ipSubjectKey(): string | null {
  try {
    const req = getRequest()
    const h = req?.headers
    const raw =
      h?.get('cf-connecting-ip') ||
      h?.get('x-real-ip') ||
      (h?.get('x-forwarded-for') ?? '').split(',')[0]?.trim() ||
      ''
    if (!raw) return null
    let hash = 5381
    for (let i = 0; i < raw.length; i++) hash = ((hash << 5) + hash + raw.charCodeAt(i)) | 0
    return 'ip:' + (hash >>> 0).toString(36)
  } catch {
    return null
  }
}
