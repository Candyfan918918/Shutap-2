/* Native React /welcome — orchestrator. Renders the four-step ceremony:
 *   auth (eager)  →  age (lazy)  →  alias (lazy)  →  welcome (lazy)
 * Later steps' code (and their server-fn imports for legal / alias /
 * welcome-email) is fetched only when the user reaches them. */
import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { clearPendingAuthReturn } from '@/lib/auth-guard'
import { useNoIndex } from '@/components/NoIndex'
import { AuthStep } from './welcome/AuthStep'
import { BG, TEXT, EyeMark, SOFT } from './welcome/shared'
import type { AliasResult } from './welcome/AliasStep'

const AgeStep = lazy(() => import('./welcome/AgeStep'))
const AliasStep = lazy(() => import('./welcome/AliasStep'))
const WelcomeEnterStep = lazy(() => import('./welcome/WelcomeEnterStep'))

type Step = 'auth' | 'age' | 'alias' | 'welcome'

function StepFallback() {
  return (
    <div className="wstep" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
      <EyeMark />
      <div style={{ fontFamily: "'Newsreader',serif", fontStyle: 'italic', fontSize: 18, color: SOFT }}>
        one sec…
      </div>
    </div>
  )
}

export function WelcomeNativePage() {
  useNoIndex()

  // Detect an OAuth/magic-link callback: supabase-js parses these on load,
  // but getSession() can resolve before the exchange finishes. When any of
  // these markers are present, we start in "checking" and wait for
  // INITIAL_SESSION / SIGNED_IN rather than briefly rendering AuthStep.
  const looksLikeAuthCallback = (() => {
    if (typeof window === 'undefined') return false
    const h = window.location.hash || ''
    const s = window.location.search || ''
    return h.includes('access_token=') || h.includes('provider_token=') || h.includes('error=')
      || /[?&](code|token_hash|error)=/.test(s)
  })()

  const initialStep: Step = (() => {
    try { if (sessionStorage.getItem('shutap_age_rejected') === '1') return 'age' } catch { /* noop */ }
    return 'auth'
  })()
  const [step, setStep] = useState<Step>(initialStep)
  const [authError, setAuthError] = useState<string | null>(null)
  const [checking, setChecking] = useState<boolean>(looksLikeAuthCallback)
  const [ageBlocked, setAgeBlocked] = useState<boolean>(() => {
    try { return sessionStorage.getItem('shutap_age_rejected') === '1' } catch { return false }
  })
  const [birth, setBirth] = useState<{ day: number; month: number; year: number }>({ day: 1, month: 1, year: new Date().getFullYear() - 30 })
  const [existingAlias, setExistingAlias] = useState<AliasResult | null>(null)
  const [finalAlias, setFinalAlias] = useState<AliasResult | null>(null)
  const signedInRef = useRef(false)

  // If the user leaves /welcome via in-app navigation without ever signing
  // in, forget the captured intent / returnTo. Otherwise a scan or spill tap
  // from hours ago would replay on the next unrelated sign-in in this tab.
  // OAuth / magic-link hand-offs are full-page navigations, so this cleanup
  // does not run for them and the intent survives the round trip.
  useEffect(() => () => { if (!signedInRef.current) clearPendingAuthReturn() }, [])

  // On mount: only skip past the auth step when a REAL (non-anonymous) user
  // is signed in. Anonymous pseudonymous sessions must still see the auth sheet.
  useEffect(() => {
    let cancelled = false
    let advanced = false
    const isAnon = (u: unknown) => Boolean((u as { is_anonymous?: boolean } | undefined)?.is_anonymous)

    const advanceForRealUser = async () => {
      if (advanced) return
      advanced = true
      signedInRef.current = true
      setChecking(true)
      void import('@/lib/tracking').then((m) => m.trackEvent('sign_in_completed', {})).catch(() => {})
      // Lazy-import server-fn modules so cold /welcome doesn't ship them.
      const [{ recordLegalAcceptance }, { getMyAlias }] = await Promise.all([
        import('@/lib/legal.functions'),
        import('@/lib/alias.functions'),
      ])

      void recordLegalAcceptance({ data: {} }).catch(() => {})

      // Retry getMyAlias once on transport/auth failure — the bearer may not
      // be attached yet immediately after the OAuth round trip. Only fall
      // through to 'age' when the row genuinely doesn't exist.
      const tryGetAlias = async (): Promise<Awaited<ReturnType<typeof getMyAlias>> | 'error'> => {
        try { return await getMyAlias() } catch { return 'error' }
      }
      let existing = await tryGetAlias()
      if (existing === 'error') {
        await new Promise((r) => setTimeout(r, 600))
        existing = await tryGetAlias()
      }
      if (cancelled) return
      try {
        if (existing === 'error') {
          // Still failing — don't force onboarding. Leave user on auth-step
          // so a refresh recovers cleanly rather than resetting alias.
          setStep('auth')
          return
        }
        if (existing?.display_name && existing.birth_year) {
          const a: AliasResult = {
            emotion: existing.emotion || '',
            nation: existing.nation || '',
            creature: existing.creature || '',
            emoji: existing.emoji || '',
            display_name: existing.display_name,
          }
          setExistingAlias(a)
          setFinalAlias(a)
          setStep('welcome')
        } else {
          setStep('age')
        }
      } finally { if (!cancelled) setChecking(false) }
    }

    const trackFail = (reason: string) => {
      void import('@/lib/tracking').then((m) => m.trackEvent('sign_in_return_failed', { reason: reason.slice(0, 200) })).catch(() => {})
    }

    const consumeHashTokens = async (): Promise<'consumed' | 'error' | 'none'> => {
      if (typeof window === 'undefined') return 'none'
      const raw = window.location.hash?.startsWith('#') ? window.location.hash.slice(1) : ''
      if (!raw) return 'none'
      const params = new URLSearchParams(raw)
      const err = params.get('error_description') || params.get('error')
      if (err) {
        try { history.replaceState(null, '', window.location.pathname + window.location.search) } catch { /* noop */ }
        setAuthError(err.replace(/\+/g, ' '))
        trackFail('provider: ' + err)
        return 'error'
      }
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      if (!access_token || !refresh_token) return 'none'
      try {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token })
        try { history.replaceState(null, '', window.location.pathname + window.location.search) } catch { /* noop */ }
        if (error) { setAuthError(error.message); trackFail('setSession: ' + error.message); return 'error' }
        return 'consumed'
      } catch (e) {
        try { history.replaceState(null, '', window.location.pathname + window.location.search) } catch { /* noop */ }
        const text = e instanceof Error ? e.message : String(e)
        setAuthError(text)
        trackFail('setSession threw: ' + text)
        return 'error'
      }
    }

    const run = async () => {
      const hashResult = await consumeHashTokens()
      if (cancelled) return
      if (hashResult === 'error') { setStep('auth'); setChecking(false); return }
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (!data.session || isAnon(data.session.user)) {
        // If this looks like an in-flight OAuth callback, don't flash AuthStep —
        // stay in checking and let onAuthStateChange fire INITIAL_SESSION/SIGNED_IN.
        if (!looksLikeAuthCallback && hashResult !== 'consumed') { setStep('auth'); setChecking(false) }
        return
      }
      await advanceForRealUser()
    }
    void run()

    // Safety net: if the callback markers were present but no auth event
    // arrives within 4s, drop back to the auth step so the user isn't stuck.
    const stuckTimer = looksLikeAuthCallback ? window.setTimeout(() => {
      if (cancelled || advanced) return
      setStep('auth')
      setChecking(false)
      setAuthError((prev) => prev ?? 'that sign-in didn’t come through — try once more')
      trackFail('callback timeout')
    }, 4000) : null


    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION fires once after supabase-js hydrates the session
      // from URL/storage — treat it like SIGNED_IN when a real session lands.
      if (event !== 'SIGNED_IN' && event !== 'USER_UPDATED' && event !== 'INITIAL_SESSION') return
      if (!session || isAnon(session.user)) return
      void advanceForRealUser()
    })
    return () => {
      cancelled = true
      if (stuckTimer !== null) window.clearTimeout(stuckTimer)
      sub.subscription.unsubscribe()
    }
  }, [looksLikeAuthCallback])

  return (
    <div style={{ background: BG, color: TEXT, minHeight: '100vh', fontFamily: "'Sora',system-ui,sans-serif", WebkitFontSmoothing: 'antialiased' }}>
      <style>{`
        @keyframes weblink {0%,34%,40%,78%,84%,100%{transform:scaleY(1)}37%,81%{transform:scaleY(.1)}}
        @keyframes wfadeUp {from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes wslotIn {from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        .wstep{animation:wfadeUp .4s ease}
        .oauth-btn:hover{background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.25)}
      `}</style>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          {checking && <StepFallback />}
          {!checking && step === 'auth' && (
            <>
              <AuthStep />
              {authError && (
                <div style={{ marginTop: 12, color: '#ff8a8a', fontSize: 13, textAlign: 'center' }}>
                  {authError}
                </div>
              )}
            </>
          )}
          {!checking && step === 'age' && (
            <Suspense fallback={<StepFallback />}>
              <AgeStep
                ageBlocked={ageBlocked}
                onBlocked={() => setAgeBlocked(true)}
                onConfirm={(b) => { setBirth(b); setStep('alias') }}
              />
            </Suspense>
          )}
          {!checking && step === 'alias' && (
            <Suspense fallback={<StepFallback />}>
              <AliasStep
                birth={birth}
                initial={existingAlias ?? undefined}
                onComplete={(a) => { setFinalAlias(a); setStep('welcome') }}
              />
            </Suspense>
          )}
          {!checking && step === 'welcome' && (
            <Suspense fallback={<StepFallback />}>
              <WelcomeEnterStep displayName={finalAlias?.display_name ?? existingAlias?.display_name ?? 'friend'} />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  )
}
