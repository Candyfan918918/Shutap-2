// The alias gate — the only wall a guest hits on this surface.
//
// It stands in front of SAVING and SHARING, never in front of reading: all
// three cards are readable before it, during it and after it. It asks for a
// fake name, not for money, and it is a bottom sheet over the deck rather than
// a route change, so nobody loses the cards they were reading.
import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { sendMagicLink } from '@/lib/magic-link.functions'
import { Button, Sheet, CompanionLine, SORA, NEWS, MUTED, ACCENT_SOFT, INK, FAINT } from './ui'

const TERMS_VERSION = '2026-09-04'

/** Why the gate went up — the companion says the true reason, not a generic one. */
const SHEET_LEAD: Record<string, string> = {
  save: 'cards need a name. a fake one.',
  share: 'cards need a name. a fake one.',
  post: 'rooms need a name too — a fake one, same as the cards.',
  keep: 'cards need a name. a fake one.',
  checkout: 'an alias first, then the clean ones.',
  limit: 'an alias keeps your cards. members get more.',
}

const SHEET_BODY: Record<string, string> = {
  save: "reading is free forever. an alias is only so your set belongs to someone — 30 seconds, no real name, no password.",
  share: "reading is free forever. an alias is only so your set belongs to someone — 30 seconds, no real name, no password.",
  post: 'nobody in a room ever sees who you are. the alias is the name they know you by, and it is not yours.',
  keep: "reading is free forever. an alias is only so your set belongs to someone — 30 seconds, no real name, no password.",
  checkout: 'the clean cards land in the same place your alias does. one link, then both.',
  limit: "an alias keeps every card you turn over, and it is the door to the members' deck — three situations a day, all three cards. a fake name — 30 seconds, no real name, no password.",
}

export function SignInSheet({
  open,
  trigger,
  onClose,
}: {
  open: boolean
  trigger: string
  onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [ok18, setOk18] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function send() {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setErr('that address did not look right. try again?')
      return
    }
    if (!ok18) {
      setErr('need the 18+ box ticked before i can make you an alias.')
      return
    }
    setErr(null)
    setBusy(true)
    try {
      try {
        localStorage.setItem('shutap_terms', JSON.stringify({ version: TERMS_VERSION, at: new Date().toISOString() }))
      } catch { /* noop */ }
      const address = email.trim()
      const redirectTo = window.location.href
      // The link goes out in shutap's own design from hello@shutap.com. If that
      // path is unavailable, Supabase's stock email still gets the alias made.
      const branded = await sendMagicLink({ data: { email: address, redirectTo } }).catch(() => null)
      if (!branded?.ok) {
        if (branded?.error === 'rate_limited') { setErr('that is a lot of links. give the last one a minute?'); return }
        const { error } = await supabase.auth.signInWithOtp({
          email: address,
          options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
        })
        if (error) { setErr('that did not send. try again in a moment?'); return }
      }
      setSent(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <CompanionLine size={32}>
        <strong style={{ fontStyle: 'normal', fontFamily: SORA, fontWeight: 700, fontSize: 18, color: INK }}>
          {SHEET_LEAD[trigger] ?? SHEET_LEAD.keep}
        </strong>
        <br />
        {SHEET_BODY[trigger] ?? SHEET_BODY.keep}
      </CompanionLine>

      {!sent ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@wherever.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void send() }}
            style={{
              width: '100%', height: 48, borderRadius: 14, padding: '0 15px', fontSize: 16,
              outline: 'none', background: '#fff', color: INK,
              border: `2px solid ${ACCENT_SOFT}`,
            }}
          />
          <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontFamily: SORA, fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
            <input
              type="checkbox"
              checked={ok18}
              onChange={(e) => setOk18(e.target.checked)}
              style={{ marginTop: 3, width: 17, height: 17, accentColor: '#8e1c4c', flex: 'none' }}
            />
            <span>i&apos;m 18 or over, and i accept the terms and privacy notice.</span>
          </label>
          {err ? (
            <div style={{ fontFamily: NEWS, fontStyle: 'italic', fontSize: 15, color: '#a8003f' }}>{err}</div>
          ) : null}
          <Button onClick={() => void send()} disabled={busy} full>
            {busy ? 'sending…' : 'send me the link'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} full>
            not now — keep reading
          </Button>
          <div style={{ fontFamily: NEWS, fontStyle: 'italic', fontSize: 13.5, color: FAINT, textAlign: 'center' }}>
            reading the cards stays free either way.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, alignItems: 'center', padding: '8px 0 4px' }}>
          <div style={{ fontFamily: NEWS, fontStyle: 'italic', fontSize: 17, color: '#2b2429', textAlign: 'center', lineHeight: 1.5 }}>
            check your inbox — link&apos;s on its way from hello@shutap.com. open it on this device and your set is still right here.
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>close</Button>
        </div>
      )}
    </Sheet>
  )
}
