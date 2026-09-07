// "clean cards" — the one upgrade screen, and the only paywall on this surface.
//
// It sells RESOLUTION, never relief. It arrives after a win (the save has
// already happened, the card is already theirs) and never before one, it never
// appears while a set is still being read, and it never appears at all for a
// crisis. Declining it costs nothing: the cards you turned over stay yours.
import type React from 'react'
import { ALWAYS_FREE, MEMBER_BENEFITS, type JokeTier } from '@/lib/jokes/deck'
import { EyeMark, ShutapWordmark } from '@/components/brand/EyeMark'
import { Button, SORA, NEWS, INTER } from './ui'

const LINK: React.CSSProperties = { color: '#e7a3c2', textDecoration: 'underline', textUnderlineOffset: 3 }

export function UpgradeSheet({
  open,
  price,
  tier,
  onClose,
  onCheckout,
}: {
  open: boolean
  price: string
  tier: JokeTier
  onClose: () => void
  onCheckout: () => void
}) {
  if (!open) return null
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 95, background: 'linear-gradient(160deg,#2e0d1a,#100c14 60%,#0a0710)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
        animation: 'shutapUpIn .34s cubic-bezier(.2,.8,.2,1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px clamp(18px,5vw,36px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <EyeMark style={{ width: 32, height: 22 }} />
          <ShutapWordmark ink="#f7e8f0" style={{ fontSize: 26, letterSpacing: '-.04em' }} />
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: SORA, fontSize: 13.5, color: '#9e7a8c', padding: 8 }}
        >
          close
        </button>
      </div>

      <div
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
          gap: 20, padding: '0 clamp(18px,5vw,36px) clamp(32px,7vh,72px)',
          maxWidth: 620, width: '100%', margin: '0 auto',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontFamily: SORA, fontWeight: 800, fontSize: 'clamp(34px,7vw,52px)', lineHeight: 1.04, letterSpacing: '-.04em', color: '#f7e8f0' }}>
            clean cards
            <br />
            <span style={{ color: '#e7548a' }}>no mark.</span>
            <br />
            four times bigger.
          </h2>
          <p style={{ margin: '14px 0 0', fontFamily: NEWS, fontStyle: 'italic', fontSize: 19, lineHeight: 1.5, color: '#c4a0b2', maxWidth: '34ch' }}>
            three situations a day, yours properly, and the mirror reading all of it.
          </p>
        </div>

        {/* what a membership buys — each line says what it is, then why */}
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {MEMBER_BENEFITS.map((b) => (
            <li key={b.line} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
              <span aria-hidden style={{ color: '#5DCAA5', fontSize: 15, lineHeight: 1.4 }}>✓</span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: SORA, fontSize: 15, color: '#f0dbe6', lineHeight: 1.4 }}>{b.line}</span>
                <span style={{ fontFamily: NEWS, fontStyle: 'italic', fontSize: 14, color: '#b08ea0', lineHeight: 1.45 }}>{b.detail}</span>
              </span>
            </li>
          ))}
        </ul>

        {/* what stays free, so nobody buys what they already have */}
        <div style={{ background: 'rgba(255,255,255,.05)', border: '.5px solid rgba(255,255,255,.12)', borderRadius: 16, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: '#9e7a8c' }}>
            always free
          </div>
          {ALWAYS_FREE.map((line) => (
            <div key={line} style={{ fontFamily: INTER, fontSize: 13.5, lineHeight: 1.5, color: '#d9bfcc' }}>· {line}</div>
          ))}
          <div style={{ fontFamily: NEWS, fontStyle: 'italic', fontSize: 13.5, color: '#9e7a8c', marginTop: 4 }}>
            new here?{' '}
            <a href="/how-it-works" target="_blank" rel="noreferrer" style={LINK}>how the cards work →</a>
          </div>
        </div>

        <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 15, color: '#f7e8f0' }}>
          {price} / month · billed today, no trial · cancel whenever
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Button onClick={onCheckout} full>
            {tier === 'guest' ? 'get my alias, then go clean' : 'go clean'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} full style={{ color: '#9e7a8c' }}>
            not now — keep the free cards
          </Button>
        </div>

        <div style={{ fontFamily: NEWS, fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.55, color: '#9e7a8c', textAlign: 'center' }}>
          renews monthly until you cancel; cancel anytime and keep access to the end of the period. payments already made are not refunded.
          the cards are ai-written jokes, not advice — a membership buys pixels and room, never relief.{' '}
          <a href="/terms#plans" target="_blank" rel="noreferrer" style={LINK}>plans &amp; limits</a> ·{' '}
          <a href="/terms#refunds" target="_blank" rel="noreferrer" style={LINK}>billing &amp; refunds</a> ·{' '}
          <a href="/privacy" target="_blank" rel="noreferrer" style={LINK}>privacy</a> ·{' '}
          <a href="/disclaimer" target="_blank" rel="noreferrer" style={LINK}>disclaimer</a>
        </div>
      </div>
      <style>{`@keyframes shutapUpIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
    </div>
  )
}
