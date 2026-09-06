// The sign-in email, in shutap's own voice and design.
//
// `supabase.auth.signInWithOtp` sends Supabase's stock template — grey Arial
// on white, "Confirm your signup" — which is not the shutap system at all.
// This server function mints the very same one-time link through the admin
// API and mails it through the `magic_link` design (Sora/Newsreader, the
// eyes, the pink ladder from tokens.css), from hello@shutap.com via Resend.
//
// The client falls back to `signInWithOtp` if this rejects, so sign-in never
// breaks when Resend is down or a key is missing — only the paint does.
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'

const inputSchema = z.object({
  email: z.string().trim().email().max(254),
  /** Where the link lands after verification. Supabase only honours URLs on
   *  its redirect allow-list, so an unlisted origin falls back to the site URL. */
  redirectTo: z.string().url().max(2000).optional(),
  /** Optional user metadata for a brand-new account (e.g. first / last name). */
  data: z.record(z.string(), z.string().max(200).nullable()).optional(),
})

export type SendMagicLinkResult = { ok: true } | { ok: false; error: string }

// Light per-instance throttle — Supabase rate-limits `signInWithOtp` for us,
// but a public server function gets nothing for free. Per address and per
// caller IP inside a rolling window; enough to blunt a script, invisible to a
// person who mistypes twice.
const WINDOW_MS = 10 * 60 * 1000
const PER_EMAIL = 4
const PER_IP = 12
const hits = new Map<string, number[]>()

function throttled(key: string, limit: number): boolean {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= limit) {
    hits.set(key, recent)
    return true
  }
  recent.push(now)
  hits.set(key, recent)
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k)
  }
  return false
}

function callerIp(): string {
  const h = getRequest()?.headers
  const fwd = h?.get('x-forwarded-for') ?? h?.get('cf-connecting-ip') ?? h?.get('x-real-ip') ?? ''
  return fwd.split(',')[0]?.trim() || 'unknown'
}

export const sendMagicLink = createServerFn({ method: 'POST' })
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data }): Promise<SendMagicLinkResult> => {
    const email = data.email.toLowerCase()
    if (throttled(`email:${email}`, PER_EMAIL) || throttled(`ip:${callerIp()}`, PER_IP)) {
      return { ok: false, error: 'rate_limited' }
    }

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { sendEmail } = await import('./email/send.server')

    // `magiclink` creates the account when the address is new (same as
    // `signInWithOtp` with `shouldCreateUser: true`), so first-timers and
    // returning aliases go through one path.
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        ...(data.redirectTo ? { redirectTo: data.redirectTo } : {}),
        ...(data.data ? { data: data.data } : {}),
      },
    })
    if (error || !link?.properties?.action_link) {
      console.warn('[sendMagicLink] generateLink failed', error?.message)
      return { ok: false, error: error?.message ?? 'generate_link_failed' }
    }

    const res = await sendEmail(
      'hello',
      'magic_link',
      {
        magic_link: link.properties.action_link,
        code: link.properties.email_otp,
        deep_link: data.redirectTo ?? 'https://shutap.com',
      },
      email,
    )
    if (!res.ok) {
      console.warn('[sendMagicLink] send failed', res.error)
      return { ok: false, error: res.error ?? 'send_failed' }
    }
    return { ok: true }
  })
