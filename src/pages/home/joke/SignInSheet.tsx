// The alias gate — the only wall a guest hits on this surface.
//
// It stands in front of SAVING and SHARING, never in front of reading: all
// three cards are readable before it, during it and after it. It asks for a
// name, not for money, and it uses the same sign-in the rest of the site does:
// Google, Apple, or the email code on /welcome. The deck they were reading is
// written down before they leave, and picked back up when they land again.
import { useState } from 'react'
import { startOAuth, type OAuthProvider } from '@/lib/oauth-signin'
import { Button, Sheet, CompanionLine, SORA, NEWS, MUTED, INK, FAINT } from './ui'

/** Why the gate went up — the companion says the true reason, not a generic one. */
const SHEET_LEAD: Record<string, string> = {
  save: 'cards need a name. a fake one.',
  share: 'cards need a name. a fake one.',
  post: 'rooms need a name too — a fake one, same as the cards.',
  keep: 'cards need a name. a fake one.',
  checkout: 'an alias first, then the mirror reading.',
  limit: 'an alias flips all three. members get the mirror reading.',
  flip: 'the other two need a name. a fake one.',
}

const SHEET_BODY: Record<string, string> = {
  save: "reading is free forever. an alias is only so your set belongs to someone — 30 seconds, no real name.",
  share: "reading is free forever. an alias is only so your set belongs to someone — 30 seconds, no real name.",
  post: 'nobody in a room ever sees who you are. the alias is the name they know you by, and it is not yours.',
  keep: "reading is free forever. an alias is only so your set belongs to someone — 30 seconds, no real name.",
  checkout: 'the mirror reading lands in the same place your alias does. one door, then both.',
  limit: "an alias flips all three cards of a situation and keeps them, and it is the door to the members' deck — three situations a day, every set kept clean, the mirror reading. 30 seconds, no real name.",
  flip: "they're already written. an alias flips them and keeps all three in your set list — 30 seconds, no real name.",
}

const GOOGLE_G = (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
    <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
    <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.615 24 12.255 24z" />
    <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z" />
    <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.64 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
  </svg>
)

const APPLE_MARK = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={INK} aria-hidden>
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
)

export function SignInSheet({
  open,
  trigger,
  onClose,
}: {
  open: boolean
  trigger: string
  onClose: () => void
}) {
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function go(provider: OAuthProvider) {
    setBusy(true)
    setErr(null)
    const message = await startOAuth(provider)
    if (message) setErr(message)
    setBusy(false)
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Button variant="secondary" disabled={busy} onClick={() => void go('google')} full>
          {GOOGLE_G} continue with Google
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => void go('apple')} full>
          {APPLE_MARK} continue with Apple
        </Button>
        <a href="/welcome" style={{ textDecoration: 'none' }}>
          <Button variant="ghost" size="sm" full>or sign in with email →</Button>
        </a>

        {err ? (
          <div style={{ fontFamily: NEWS, fontStyle: 'italic', fontSize: 15, color: '#a8003f' }}>{err}</div>
        ) : null}

        <Button variant="ghost" size="sm" onClick={onClose} full>
          not now — keep reading
        </Button>

        <div style={{ fontFamily: NEWS, fontStyle: 'italic', fontSize: 12.5, lineHeight: 1.55, color: FAINT, textAlign: 'center' }}>
          18+ only · your real name is never attached to anything here
          <br />
          by continuing you agree to our{' '}
          <a href="/terms" target="_blank" rel="noreferrer" style={{ color: MUTED, textDecoration: 'underline', textUnderlineOffset: 2 }}>terms</a>
          {' '}and{' '}
          <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: MUTED, textDecoration: 'underline', textUnderlineOffset: 2 }}>privacy notice</a>.
          <br />
          the cards you flipped stay right here either way.
        </div>
      </div>
    </Sheet>
  )
}
