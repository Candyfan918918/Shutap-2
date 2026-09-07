// Hourly cron: "we email you before the trial ends — no surprises."
// Sends the mirror_trial_ending reminder to trialing mirror subscribers
// whose trial ends within the next 48 hours. New subscriptions carry no
// trial any more; this serves the trials that were already running.
// The first-charge amount comes from the real Stripe price (never hardcoded).
// Idempotent via billing_emails (kind + subscription id + trial end), so the
// hourly cadence and cron retries never double-send; a cancelled-at-period-end
// trial gets no reminder — there is no charge coming.
import { createFileRoute } from '@tanstack/react-router'

const REMINDER_WINDOW_MS = 48 * 60 * 60 * 1000

export const Route = createFileRoute('/api/public/hooks/trial-ending-emails')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get('x-cron-secret') ?? ''
        const expected = process.env.CRON_SECRET ?? ''
        if (!expected || provided.length !== expected.length || provided !== expected) {
          return new Response('Unauthorized', { status: 401 })
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { sendBillingEmail, formatEmailDate, formatStripeAmount } = await import('@/lib/email/billing.server')
        const { createStripeClient } = await import('@/lib/stripe.server')

        const now = Date.now()
        const { data: subs, error } = await supabaseAdmin
          .from('subscriptions')
          .select('user_id, stripe_subscription_id, price_id, environment, current_period_end, cancel_at_period_end')
          .eq('status', 'trialing')
          .eq('product_id', 'mirror')
          .gt('current_period_end', new Date(now).toISOString())
          .lte('current_period_end', new Date(now + REMINDER_WINDOW_MS).toISOString())
          .limit(500)
        if (error) return Response.json({ error: error.message }, { status: 500 })

        let sent = 0
        let duplicates = 0
        let skipped = 0
        let failed = 0

        // One Stripe price lookup per (environment, price_id) pair per run.
        const priceCache = new Map<string, { amount: string; interval: string } | null>()

        for (const s of subs ?? []) {
          if (s.cancel_at_period_end) { skipped++; continue }

          const cacheKey = `${s.environment}:${s.price_id}`
          if (!priceCache.has(cacheKey)) {
            try {
              const stripe = createStripeClient(s.environment as 'sandbox' | 'live')
              const prices = await stripe.prices.list({ lookup_keys: [s.price_id as string] })
              const p = prices.data[0]
              priceCache.set(
                cacheKey,
                p?.unit_amount != null
                  ? {
                      amount: formatStripeAmount(p.unit_amount, p.currency),
                      interval: p.recurring?.interval === 'year' ? 'annual' : 'monthly',
                    }
                  : null,
              )
            } catch {
              priceCache.set(cacheKey, null)
            }
          }
          const price = priceCache.get(cacheKey)
          const trialEndIso = new Date(s.current_period_end as string).toISOString()

          const outcome = await sendBillingEmail({
            kind: 'mirror_trial_ending',
            dedupeKey: `${s.stripe_subscription_id}:${trialEndIso}`,
            userId: s.user_id as string,
            vars: {
              trial_end: formatEmailDate(trialEndIso),
              amount: price?.amount ?? '',
              plan_interval:
                price?.interval ?? (String(s.price_id).includes('annual') ? 'annual' : 'monthly'),
              manage_url: 'https://shutap.com/profile',
              deep_link: 'https://shutap.com/mirror',
            },
          })
          if (outcome === 'sent') sent++
          else if (outcome === 'duplicate') duplicates++
          else failed++
        }

        return Response.json({ candidates: subs?.length ?? 0, sent, duplicates, skipped, failed })
      },
    },
  },
})
