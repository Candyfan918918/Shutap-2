import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from '@/compat/router'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'
import { useServerFn } from '@tanstack/react-start'
import { getStripe, getStripeEnvironment } from '@/lib/stripe'
import { createMirrorCheckout, createMirrorPortal } from '@/lib/payments.functions'
import { getMyBillingStatus, type BillingStatus } from '@/lib/billing.functions'
import { PLAN_TO_PRICE, usd, type PlanKey } from '@/lib/pricing'
import { supabase } from '@/integrations/supabase/client'
import { useNoIndex } from '@/components/NoIndex'
import eyeMascot from '@/assets/eye-mascot.svg'
import stripeWordmark from '@/assets/stripe-wordmark.svg'

// Single source of truth for mirror pricing. Every dollar figure on this page
// and on /subscribe/return is computed from these amounts — never hardcoded
// in JSX. Amounts are the pre-tax list prices; Stripe adds location-based tax
// inside the embedded checkout (automatic_tax is enabled server-side).
// The amounts themselves live in @/lib/pricing so the upgrade sheet on the
// joke surface quotes the same number this page charges.
const MONTHLY_TIMES_TWELVE = PLAN_TO_PRICE.monthly.amount * 12
const ANNUAL_PER_MONTH = PLAN_TO_PRICE.annual.amount / 12
const ANNUAL_SAVINGS_PCT = Math.round((1 - PLAN_TO_PRICE.annual.amount / MONTHLY_TIMES_TWELVE) * 100)

// Light homepage theme tokens.
const INK = '#100c14'
const MUTED = '#8a6577'
const SOFT_MUTED = '#a98a99'
const ACCENT = '#a52a5f'
const DEEP_ACCENT = '#c1216b'
const PAGE_BG = '#ffffff'
const HAIRLINE = 'rgba(27,15,22,.12)'

const fadeUpKeyframes = `
@keyframes shutapSubFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`

function fadeUp(delay = 0): CSSProperties {
  return { animation: `shutapSubFadeUp .5s ease ${delay}s both` }
}

function LockGlyph({ color = MUTED, size = 11 }: { color?: string; size?: number }) {
  return (
    <svg width={Math.round((size * 9) / 11)} height={size} viewBox="0 0 9 11" fill="none" style={{ flex: 'none' }}>
      <rect x="0.5" y="4.5" width="8" height="6" rx="1.5" stroke={color} />
      <path d="M2.5 4.5V3a2 2 0 0 1 4 0v1.5" stroke={color} fill="none" />
    </svg>
  )
}

function CheckGlyph({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round((size * 10) / 11)} viewBox="0 0 11 10" fill="none" style={{ flex: 'none' }}>
      <path d="M1.5 5l3 3 5-6.5" stroke={DEEP_ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TopBar({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30 }}>
      <button
        onClick={onBack}
        style={{ background: 'transparent', border: 'none', color: MUTED, fontFamily: 'Newsreader, serif', fontStyle: 'italic', fontSize: 14.5, cursor: 'pointer', padding: 0 }}
      >
        ← back
      </button>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '.5px solid rgba(27,15,22,.18)', borderRadius: 999, padding: '5px 11px', background: 'rgba(255,255,255,.5)' }}>
        <LockGlyph size={11} />
        <span style={{ fontFamily: 'Sora, sans-serif', fontSize: 9.5, fontWeight: 600, letterSpacing: '.09em', textTransform: 'uppercase', color: MUTED }}>
          secure · stripe
        </span>
      </div>
    </div>
  )
}

function planCardStyle(selected: boolean): CSSProperties {
  return {
    border: selected ? `2px solid ${ACCENT}` : `1px solid ${HAIRLINE}`,
    background: '#ffffff',
    boxShadow: selected ? '0 12px 36px rgba(231,84,138,.20)' : '0 4px 16px rgba(27,15,22,.05)',
    borderRadius: 18,
    padding: '18px 20px',
    cursor: 'pointer',
    transition: 'border-color .18s ease, box-shadow .18s ease',
  }
}

export function SubscribePage() {
  useNoIndex()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const initialPlan = (search.get('plan') === 'monthly' ? 'monthly' : 'annual') as PlanKey
  const [planKey, setPlanKey] = useState<PlanKey>(initialPlan)
  const plan = PLAN_TO_PRICE[planKey]
  const [err, setErr] = useState<string | null>(null)

  const [authed, setAuthed] = useState<boolean | null>(null)
  const [checked, setChecked] = useState(false)
  const [alreadySubbed, setAlreadySubbed] = useState(false)
  const [portalBusy, setPortalBusy] = useState(false)

  const fetchStatus = useServerFn(getMyBillingStatus)
  const openPortalFn = useServerFn(createMirrorPortal)

  useEffect(() => {
    // A background ANONYMOUS session is not a real account: treat it as
    // signed out so checkout prompts sign-in instead of failing server-side.
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user as { is_anonymous?: boolean } | undefined
      setAuthed(Boolean(data.session) && !user?.is_anonymous)
    })
  }, [])

  useEffect(() => {
    if (authed === false) {
      // Come back to the plan they were quoted, not the homepage.
      try { sessionStorage.setItem('shutap_returnTo', `/subscribe?plan=${planKey}`) } catch { /* noop */ }
      navigate('/welcome', { replace: true })
    }
  }, [authed, planKey, navigate])

  // Duplicate-subscription guard: if the user already has an active row,
  // stop rendering checkout and offer the portal instead.
  useEffect(() => {
    if (!authed) return
    let done = false
    ;(async () => {
      try {
        const s = await fetchStatus({ data: { environment: getStripeEnvironment() } })
        if (done) return
        if (s?.isActive) setAlreadySubbed(true)
      } catch { /* treat as not subscribed */ }
      finally { if (!done) setChecked(true) }
    })()
    return () => { done = true }
  }, [authed, fetchStatus])

  async function openPortal() {
    setPortalBusy(true)
    try {
      const result = await openPortalFn({
        data: { environment: getStripeEnvironment(), returnUrl: `${window.location.origin}/profile` },
      })
      if ('error' in result) throw new Error(result.error)
      window.location.href = result.url
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not open billing portal')
      setPortalBusy(false)
    }
  }

  const fetchClientSecret = async (): Promise<string> => {
    try {
      const result = await createMirrorCheckout({
        data: {
          priceId: plan.id,
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/subscribe/return?session_id={CHECKOUT_SESSION_ID}`,
        },
      })
      if ('error' in result) throw new Error(result.error)
      if (!result.clientSecret) throw new Error('No client secret returned')
      return result.clientSecret
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not start checkout'
      setErr(msg)
      throw e
    }
  }

  function selectPlan(k: PlanKey) {
    if (planKey === k) return
    setPlanKey(k)
    setErr(null)
    navigate(`/subscribe?plan=${k}`, { replace: true })
  }

  if (authed === null || (authed && !checked)) return null

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, color: INK, fontFamily: 'Inter, system-ui, sans-serif', position: 'relative', overflow: 'hidden' }}>
      <style>{fadeUpKeyframes}</style>

      {/* ambient glow */}
      <div style={{ position: 'absolute', top: -180, left: '50%', transform: 'translateX(-50%)', width: 640, height: 420, background: 'radial-gradient(closest-side, rgba(231,84,138,.14), rgba(231,84,138,0))', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', maxWidth: 500, margin: '0 auto', padding: '26px 20px 72px', display: 'flex', flexDirection: 'column' }}>
        <TopBar onBack={() => navigate(-1)} />

        {/* header */}
        <div style={fadeUp()}>
          <img src={eyeMascot} alt="" style={{ width: 38, height: 38, marginBottom: 14, display: 'block' }} />
          <h1 style={{ fontFamily: 'Newsreader, serif', fontStyle: 'italic', fontWeight: 400, fontSize: 31, lineHeight: 1.25, margin: '0 0 10px', color: INK }}>
            open the full mirror.
          </h1>
          <p style={{ fontFamily: 'Newsreader, serif', fontStyle: 'italic', fontSize: 15.5, lineHeight: 1.55, color: MUTED, margin: '0 0 22px', maxWidth: '38ch' }}>
            every scan adds a brushstroke. the mirror holds the whole portrait.
          </p>
        </div>

        {/* what opens */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 28, ...fadeUp(0.06) }}>
          {[
            'three situations a day, not one — everything kept',
            'exports with no shutap mark, print-size, the set in one tap',
            'patterns across your cards and scans — named',
            'your arc over time, with proof',
            "what others who've been here came through",
          ].map((line) => (
            <div key={line} style={{ display: 'flex', alignItems: 'baseline', gap: 11 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: ACCENT, flex: 'none', transform: 'translateY(-2px)' }} />
              <span style={{ fontFamily: 'Sora, sans-serif', fontSize: 13.5, fontWeight: 600, color: INK }}>{line}</span>
            </div>
          ))}
        </div>

        {alreadySubbed ? (
          /* already subscribed */
          <div style={{ background: '#ffffff', border: '1px solid rgba(27,15,22,.10)', borderRadius: 18, padding: 22, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 10px 32px rgba(193,33,107,.08)', ...fadeUp(0.1) }}>
            <div style={{ fontFamily: 'Newsreader, serif', fontStyle: 'italic', fontSize: 19, lineHeight: 1.4, color: INK }}>
              you're already subscribed.
            </div>
            <div style={{ color: MUTED, fontSize: 14, lineHeight: 1.55 }}>
              manage your plan, update your payment method, or cancel from the billing portal.
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={openPortal}
                disabled={portalBusy}
                style={{ background: ACCENT, color: '#fff', border: 'none', borderRadius: 999, padding: '11px 20px', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
              >
                {portalBusy ? 'opening…' : 'manage billing →'}
              </button>
              <button
                onClick={() => navigate('/mirror')}
                style={{ background: 'transparent', color: MUTED, border: '1px solid rgba(27,15,22,.18)', borderRadius: 999, padding: '11px 20px', fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}
              >
                go to mirror →
              </button>
            </div>
            {err && <div style={{ color: DEEP_ACCENT, fontSize: 13 }}>{err}</div>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* plan cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, ...fadeUp(0.1) }}>
              {/* annual — featured */}
              <div role="button" tabIndex={0} onClick={() => selectPlan('annual')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectPlan('annual') }} style={planCardStyle(planKey === 'annual')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 14.5, color: INK }}>{PLAN_TO_PRICE.annual.label}</span>
                  <span style={{ fontFamily: 'Sora, sans-serif', fontSize: 9.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#fff', background: DEEP_ACCENT, borderRadius: 999, padding: '4px 10px' }}>
                    best value · save {ANNUAL_SAVINGS_PCT}%
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: 30, lineHeight: 1, color: INK }}>{usd(PLAN_TO_PRICE.annual.amount)}</span>
                  <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 400, fontSize: 14, color: MUTED }}>/year</span>
                  <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: 14, color: '#c4a3b2', textDecoration: 'line-through' }}>{usd(MONTHLY_TIMES_TWELVE)}</span>
                </div>
                <div style={{ fontFamily: 'Newsreader, serif', fontStyle: 'italic', fontSize: 13.5, color: MUTED }}>
                  works out to {usd(ANNUAL_PER_MONTH)}/mo
                </div>
              </div>

              {/* monthly */}
              <div role="button" tabIndex={0} onClick={() => selectPlan('monthly')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectPlan('monthly') }} style={planCardStyle(planKey === 'monthly')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 14.5, color: INK }}>{PLAN_TO_PRICE.monthly.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: 24, lineHeight: 1, color: INK }}>{usd(PLAN_TO_PRICE.monthly.amount)}</span>
                  <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 400, fontSize: 14, color: MUTED }}>/month</span>
                </div>
                <div style={{ fontFamily: 'Newsreader, serif', fontStyle: 'italic', fontSize: 13.5, color: MUTED }}>
                  flexible — cancel anytime
                </div>
              </div>
            </div>

            {/* billing, plainly */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 28, ...fadeUp(0.14) }}>
              {[
                `${usd(plan.amount)} charged today, then every ${plan.interval} — no free trial`,
                'we email a receipt for every charge — no surprises',
                'cancel anytime from your profile; access runs to the end of the period',
              ].map((line) => (
                <div key={line} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckGlyph />
                  <span style={{ fontFamily: 'Sora, sans-serif', fontSize: 12.5, fontWeight: 600, color: '#5f4450' }}>{line}</span>
                </div>
              ))}
            </div>

            {/* checkout */}
            <div style={fadeUp(0.18)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <LockGlyph size={12} />
                <span style={{ fontFamily: 'Sora, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: MUTED }}>
                  secure checkout
                </span>
                <span style={{ height: 1, flex: 1, background: 'rgba(27,15,22,.10)' }} />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: 'Sora, sans-serif', fontSize: 10.5, color: SOFT_MUTED }}>powered by</span>
                  <img src={stripeWordmark} alt="Stripe" style={{ height: 15, display: 'block' }} />
                </span>
              </div>

              {err ? (
                <div style={{ background: 'rgba(231,84,138,.08)', border: '1px solid rgba(231,84,138,.35)', borderRadius: 12, padding: 14, color: DEEP_ACCENT, fontSize: 13.5 }}>
                  {err}
                </div>
              ) : (
                <div style={{ background: '#ffffff', border: '1px solid rgba(27,15,22,.08)', borderRadius: 16, padding: '20px 18px', boxShadow: '0 14px 44px rgba(193,33,107,.10)' }}>
                  <EmbeddedCheckoutProvider key={plan.id} stripe={getStripe()} options={{ fetchClientSecret }}>
                    <EmbeddedCheckout />
                  </EmbeddedCheckoutProvider>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 12 }}>
                <LockGlyph color={SOFT_MUTED} size={11} />
                <span style={{ fontFamily: 'Sora, sans-serif', fontSize: 11, color: SOFT_MUTED }}>
                  encrypted — your card details go to stripe, never to shutap's servers
                </span>
              </div>
            </div>

            {/* fine print */}
            <div style={{ fontFamily: 'Newsreader, serif', fontStyle: 'italic', fontSize: 12.5, lineHeight: 1.6, color: SOFT_MUTED, marginTop: 22, ...fadeUp(0.22) }}>
              founders' pricing — locked in while you stay subscribed. cancel anytime from your profile; it takes effect at the end of the period, and you go back to the free deal: one situation a day, one card. typing a situation, the scan and reading the card you turned over stay free, always. a membership buys room and pixels, never advice or relief. by subscribing you agree to the{' '}
              <a href="/terms" style={{ color: MUTED, textDecoration: 'underline' }}>terms</a>,{' '}
              <a href="/privacy" style={{ color: MUTED, textDecoration: 'underline' }}>privacy policy</a>,{' '}
              <a href="/disclaimer" style={{ color: MUTED, textDecoration: 'underline' }}>disclaimer</a> and{' '}
              <a href="/terms#refunds" style={{ color: MUTED, textDecoration: 'underline' }}>refund policy</a>. new here?{' '}
              <a href="/how-it-works" style={{ color: MUTED, textDecoration: 'underline' }}>how the cards work</a>.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function SubscribeReturnPage() {
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const sessionId = search.get('session_id')
  const [state, setState] = useState<'checking' | 'ok' | 'missing' | 'incomplete'>('checking')
  const [billing, setBilling] = useState<BillingStatus>(null)
  const [portalBusy, setPortalBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const fetchStatus = useServerFn(getMyBillingStatus)
  const openPortalFn = useServerFn(createMirrorPortal)

  useEffect(() => {
    if (!sessionId) { setState('missing'); return }
    let cancelled = false
    // Poll billing status briefly — webhook may land a moment after redirect.
    const started = Date.now()
    const check = async () => {
      try {
        const s = await fetchStatus({ data: { environment: getStripeEnvironment() } })
        if (cancelled) return
        if (s?.isActive) { setBilling(s); setState('ok'); return }
      } catch { /* keep polling */ }
      if (Date.now() - started > 8000) {
        if (!cancelled) setState('incomplete')
        return
      }
      setTimeout(check, 1000)
    }
    void check()
    return () => { cancelled = true }
  }, [sessionId, fetchStatus])

  async function openPortal() {
    setPortalBusy(true)
    try {
      const result = await openPortalFn({
        data: { environment: getStripeEnvironment(), returnUrl: `${window.location.origin}/profile` },
      })
      if ('error' in result) throw new Error(result.error)
      window.location.href = result.url
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not open billing portal')
      setPortalBusy(false)
    }
  }

  // All summary values come from the real billing status row — never hardcoded.
  const planEntry = billing?.priceId
    ? Object.values(PLAN_TO_PRICE).find((p) => p.id === billing.priceId) ?? null
    : null
  const planLine = planEntry
    ? `${planEntry.label} · ${usd(planEntry.amount)}/${planEntry.interval === 'year' ? 'yr' : 'mo'}`
    : billing?.priceId ?? null
  const periodEndDate = billing?.currentPeriodEnd
    ? new Date(billing.currentPeriodEnd)
        .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        .toLowerCase()
    : null
  const trialing = billing?.status === 'trialing'

  const title = state === 'ok' ? 'the mirror is open.'
    : state === 'checking' ? 'confirming your subscription…'
    : state === 'incomplete' ? 'we couldn\'t confirm your subscription yet.'
    : 'no checkout session found.'
  const body = state === 'ok'
    ? (trialing
        ? 'your trial is running — the whole portrait is yours.'
        : 'your subscription is active — the whole portrait is yours.')
    : state === 'checking' ? 'one moment while stripe finalizes.'
    : state === 'incomplete' ? 'if you completed payment, it should appear on your profile within a minute. otherwise, try again.'
    : 'try starting checkout again.'

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, color: INK, fontFamily: 'Inter, system-ui, sans-serif', position: 'relative', overflow: 'hidden' }}>
      <style>{fadeUpKeyframes}</style>

      {/* ambient glow */}
      <div style={{ position: 'absolute', top: -180, left: '50%', transform: 'translateX(-50%)', width: 640, height: 420, background: 'radial-gradient(closest-side, rgba(231,84,138,.14), rgba(231,84,138,0))', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', maxWidth: 500, margin: '0 auto', padding: '26px 20px 72px', display: 'flex', flexDirection: 'column' }}>
        <TopBar onBack={() => navigate('/profile')} />

        <div style={fadeUp()}>
          {state === 'ok' && (
            <span style={{ width: 46, height: 46, borderRadius: 999, background: 'rgba(231,84,138,.14)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <svg width="18" height="15" viewBox="0 0 11 10" fill="none">
                <path d="M1.5 5l3 3 5-6.5" stroke={DEEP_ACCENT} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          )}
          <h1 style={{ fontFamily: 'Newsreader, serif', fontStyle: 'italic', fontWeight: 400, fontSize: 31, lineHeight: 1.25, margin: '0 0 10px', color: INK }}>
            {title}
          </h1>
          <p style={{ fontFamily: 'Newsreader, serif', fontStyle: 'italic', fontSize: 15.5, lineHeight: 1.55, color: MUTED, margin: '0 0 24px', maxWidth: '40ch' }}>
            {body}
          </p>
        </div>

        {state === 'ok' && (
          <div style={fadeUp(0.06)}>
            <div style={{ background: '#ffffff', border: '1px solid rgba(27,15,22,.10)', borderRadius: 18, padding: '6px 20px', boxShadow: '0 10px 32px rgba(193,33,107,.08)', marginBottom: 20 }}>
              {planLine && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 14, padding: '14px 0', borderBottom: '1px solid rgba(27,15,22,.07)' }}>
                  <span style={{ fontFamily: 'Sora, sans-serif', fontSize: 12, fontWeight: 600, color: MUTED }}>plan</span>
                  <span style={{ fontFamily: 'Sora, sans-serif', fontSize: 13.5, fontWeight: 700, color: INK }}>{planLine}</span>
                </div>
              )}
              {periodEndDate && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 14, padding: '14px 0', borderBottom: '1px solid rgba(27,15,22,.07)' }}>
                  <span style={{ fontFamily: 'Sora, sans-serif', fontSize: 12, fontWeight: 600, color: MUTED }}>{trialing ? 'trial ends' : 'renews'}</span>
                  <span style={{ fontFamily: 'Sora, sans-serif', fontSize: 13.5, fontWeight: 700, color: INK }}>{periodEndDate}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 14, padding: '14px 0' }}>
                <span style={{ fontFamily: 'Sora, sans-serif', fontSize: 12, fontWeight: 600, color: MUTED }}>reminder</span>
                <span style={{ fontFamily: 'Newsreader, serif', fontStyle: 'italic', fontSize: 13.5, color: '#5f4450' }}>we'll email you before it ends</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
              <button
                onClick={() => navigate('/mirror')}
                style={{ background: ACCENT, color: '#fff', border: 'none', borderRadius: 999, padding: '12px 22px', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                go to the mirror →
              </button>
              <button
                onClick={openPortal}
                disabled={portalBusy}
                style={{ background: 'transparent', color: MUTED, border: '1px solid rgba(27,15,22,.18)', borderRadius: 999, padding: '12px 22px', fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                {portalBusy ? 'opening…' : 'manage billing'}
              </button>
            </div>
            {err && <div style={{ color: DEEP_ACCENT, fontSize: 13, marginBottom: 14 }}>{err}</div>}

            <div style={{ fontFamily: 'Newsreader, serif', fontStyle: 'italic', fontSize: 12.5, lineHeight: 1.6, color: SOFT_MUTED }}>
              manage or cancel anytime from your profile — cancellation applies at the end of the period.
            </div>
          </div>
        )}

        {(state === 'incomplete' || state === 'missing') && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', ...fadeUp(0.06) }}>
            <button
              onClick={() => navigate('/subscribe')}
              style={{ background: 'transparent', color: MUTED, border: '1px solid rgba(27,15,22,.18)', borderRadius: 999, padding: '12px 22px', fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              try checkout again →
            </button>
            <button
              onClick={() => navigate('/profile')}
              style={{ background: 'transparent', color: MUTED, border: '1px solid rgba(27,15,22,.18)', borderRadius: 999, padding: '12px 22px', fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              go to profile
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
