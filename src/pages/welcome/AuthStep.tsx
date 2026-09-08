/* Auth step: OAuth (Google/Apple) + magic-link email. Imported eagerly so
 * first paint of /welcome doesn't Suspense. Does NOT advance step itself —
 * parent's onAuthStateChange picks up SIGNED_IN and drives the flow. */
import { useState } from 'react'
import { Words } from '@/components/motion'
import { supabase } from '@/integrations/supabase/client'
import { sendMagicLink } from '@/lib/magic-link.functions'
import { startOAuth } from '@/lib/oauth-signin'
import { EyeMark, oauthBtn, ACCENT, TEXT, SOFT, MUTED, type Msg } from './shared'

function splitName(raw: string): { first_name: string; last_name: string | null; full_name: string } {
  const full = raw.trim().replace(/\s+/g, ' ')
  const idx = full.indexOf(' ')
  if (idx === -1) return { first_name: full, last_name: null, full_name: full }
  return { first_name: full.slice(0, idx), last_name: full.slice(idx + 1).trim() || null, full_name: full }
}

export function AuthStep() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [emailPhase, setEmailPhase] = useState<'input' | 'code'>('input')
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<Msg>(null)
  const [busy, setBusy] = useState(false)

  const track = (name: string, props: Record<string, unknown> = {}) => {
    void import('@/lib/tracking').then((m) => m.trackEvent(name, props)).catch(() => {})
  }

  // Shared with the joke-card sign-in sheet so the two cannot drift.
  const runOAuth = async (provider: 'google' | 'apple') => {
    const message = await startOAuth(provider)
    if (message) setMsg({ kind: 'err', text: message })
  }

  const doOAuth = (provider: 'google' | 'apple') => {
    setBusy(true); setMsg(null)
    void runOAuth(provider).finally(() => setBusy(false))
  }

  const doEmail = async () => {
    const nameTrim = name.trim().replace(/\s+/g, ' ')
    const v = email.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { setMsg({ kind: 'err', text: 'enter a valid email' }); return }
    setBusy(true); setMsg(null)
    track('sign_in_started', { method: 'email' })
    try {
      const emailRedirectTo = window.location.origin + '/welcome'
      const parts = nameTrim ? splitName(nameTrim) : undefined
      // Branded link + code from hello@shutap.com; Supabase's stock email is
      // only the fallback when that path is unavailable.
      const branded = await sendMagicLink({ data: { email: v, redirectTo: emailRedirectTo, ...(parts ? { data: parts } : {}) } }).catch(() => null)
      if (!branded?.ok) {
        if (branded?.error === 'rate_limited') {
          setMsg({ kind: 'err', text: 'too many links in a row — give the last one a minute.' })
          track('sign_in_failed', { method: 'email', reason: 'rate_limited' })
          return
        }
        const { error: otpErr } = await supabase.auth.signInWithOtp({ email: v, options: { emailRedirectTo, shouldCreateUser: true, ...(parts ? { data: parts } : {}) } })
        if (otpErr) {
          setMsg({ kind: 'err', text: otpErr.message })
          track('sign_in_failed', { method: 'email', reason: otpErr.message })
          return
        }
      }
      setEmailPhase('code')
      setMsg({ kind: 'ok', text: 'we emailed you a 6-digit code — enter it below (the magic link also works).' })
      track('sign_in_code_sent', { method: 'email' })
    } catch (e) {
      const text = e instanceof Error ? e.message : 'sign-in failed'
      setMsg({ kind: 'err', text })
      track('sign_in_failed', { method: 'email', reason: text })
    } finally { setBusy(false) }
  }


  const verifyEmailCode = async () => {
    const token = code.trim()
    if (!/^\d{6}$/.test(token)) { setMsg({ kind: 'err', text: 'enter the 6-digit code from the email' }); return }
    setBusy(true); setMsg(null)
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' })
      if (error) {
        setMsg({ kind: 'err', text: error.message })
        track('sign_in_failed', { method: 'email_code', reason: error.message })
        return
      }
      const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>
      const hasName = typeof meta.first_name === 'string' && meta.first_name.trim().length > 0
        || typeof meta.full_name === 'string' && (meta.full_name as string).trim().length > 0
      const nameTrim = name.trim().replace(/\s+/g, ' ')
      if (!hasName && nameTrim) {
        try { await supabase.auth.updateUser({ data: splitName(nameTrim) }) } catch { /* noop */ }
      }
      setMsg({ kind: 'ok', text: 'verified.' })
    } catch (e) {
      const text = e instanceof Error ? e.message : 'verification failed'
      setMsg({ kind: 'err', text })
      track('sign_in_failed', { method: 'email_code', reason: text })
    } finally { setBusy(false) }

  }

  return (
    <div className="wstep" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ textAlign: 'center' }}>
        <EyeMark />
        <div style={{ marginTop: 20, fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 26, letterSpacing: '-.04em', marginBottom: 10 }}>
          shut<span style={{ color: ACCENT }}>ap</span>
        </div>
        <Words as="div" style={{ fontFamily: "'Newsreader',serif", fontStyle: 'italic', fontSize: 18, lineHeight: 1.45, color: SOFT, marginBottom: 4 }}>before the room hears you,</Words>
        <Words as="div" style={{ fontFamily: "'Newsreader',serif", fontStyle: 'italic', fontSize: 18, lineHeight: 1.45, color: TEXT }}>you need a name.</Words>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="oauth-btn" style={oauthBtn} disabled={busy} onClick={() => doOAuth('google')}>
          <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.615 24 12.255 24z"/><path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"/><path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.64 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
          continue with Google
        </button>
        <button className="oauth-btn" style={oauthBtn} disabled={busy} onClick={() => doOAuth('apple')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill={TEXT}><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
          continue with Apple
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, margin: '6px 0' }}>
          <div style={{ flex: 1, height: .5, background: 'rgba(255,255,255,.12)' }} />
          <span style={{ fontFamily: "'Newsreader',serif", fontStyle: 'italic', fontSize: 13, color: MUTED }}>or</span>
          <div style={{ flex: 1, height: .5, background: 'rgba(255,255,255,.12)' }} />
        </div>
        {emailPhase === 'input' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <input
              type="text"
              autoComplete="name"
              placeholder="your name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doEmail()}
              style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 12, padding: '13px 15px', color: TEXT, fontFamily: "'Sora',sans-serif", fontSize: 15, outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: 9 }}>
              <input
                type="email"
                placeholder="your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doEmail()}
                style={{ flex: 1, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 12, padding: '13px 15px', color: TEXT, fontFamily: "'Sora',sans-serif", fontSize: 15, outline: 'none' }}
              />
              <button
                onClick={doEmail}
                disabled={busy}
                style={{ padding: '13px 18px', background: ACCENT, border: 'none', borderRadius: 12, color: '#fff', fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >go →</button>
            </div>
            {msg && msg.kind === 'err' && (
              <div style={{ fontFamily: "'Newsreader',serif", fontStyle: 'italic', fontSize: 13, color: ACCENT }}>{msg.text}</div>
            )}
          </div>
        )}
        {emailPhase === 'code' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="email-code-step">
            <div style={{ display: 'flex', gap: 9 }}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D+/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && verifyEmailCode()}
                style={{ flex: 1, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 12, padding: '13px 15px', color: TEXT, fontFamily: "'Sora',sans-serif", fontSize: 20, letterSpacing: '.4em', outline: 'none', textAlign: 'center' }}
              />
              <button
                onClick={verifyEmailCode}
                disabled={busy}
                style={{ padding: '13px 18px', background: ACCENT, border: 'none', borderRadius: 12, color: '#fff', fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >verify →</button>
            </div>
            <button
              type="button"
              onClick={() => { setCode(''); setEmailPhase('input'); setMsg(null) }}
              style={{ background: 'transparent', border: 0, color: MUTED, fontFamily: "'Newsreader',serif", fontStyle: 'italic', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
            >use a different email</button>
          </div>
        )}
        {msg && emailPhase === 'code' && (
          <div style={{ fontFamily: "'Newsreader',serif", fontStyle: 'italic', fontSize: 13, color: msg.kind === 'err' ? ACCENT : SOFT }}>{msg.text}</div>
        )}
      </div>
      <div style={{ textAlign: 'center', fontFamily: "'Newsreader',serif", fontStyle: 'italic', fontSize: 12.5, color: MUTED }}>
        18+ only · your real name is never attached to anything here
      </div>
      <div style={{ textAlign: 'center', fontFamily: "'Newsreader',serif", fontStyle: 'italic', fontSize: 12.5, color: MUTED, marginTop: 6 }}>
        by continuing you agree to our <a href="/terms" style={{ color: MUTED, textDecoration: 'underline' }}>terms</a> and <a href="/privacy" style={{ color: MUTED, textDecoration: 'underline' }}>privacy policy</a>
      </div>
    </div>
  )
}

export default AuthStep
