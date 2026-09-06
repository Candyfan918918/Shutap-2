// "clean cards" — the one upgrade screen, and the only paywall on this surface.
//
// It sells RESOLUTION, never relief. It arrives after a win (the save has
// already happened, the card is already theirs) and never before one, it never
// appears while a set is still being read, and it never appears at all for a
// crisis. Declining it costs nothing: all three cards stay free, forever.
import type { JokeTier } from '@/lib/jokes/deck'
import { EyeMark, ShutapWordmark } from '@/components/brand/EyeMark'
import { Button, SORA, NEWS } from './ui'

const LINES = [
  'three situations a day, not two',
  'turn over all three cards of every set',
  'exports with no shutap mark',
  '2160×3840 — print-size',
  'save all three as a set',
  'the mirror — what your situations keep saying',
]

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
            more of them, all of them turned over, and yours properly.
          </p>
        </div>

        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 11 }}>
          {LINES.map((line) => (
            <li key={line} style={{ display: 'flex', gap: 11, alignItems: 'center', fontFamily: SORA, fontSize: 15, color: '#f0dbe6' }}>
              <span style={{ color: '#5DCAA5', fontSize: 15 }}>✓</span>
              {line}
            </li>
          ))}
        </ul>

        <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 15, color: '#f7e8f0' }}>
          {price} / month · cancel whenever
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Button onClick={onCheckout} full>
            {tier === 'guest' ? 'get my alias, then go clean' : 'go clean'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} full style={{ color: '#9e7a8c' }}>
            not now — keep the free cards
          </Button>
        </div>

        <div style={{ fontFamily: NEWS, fontStyle: 'italic', fontSize: 14.5, color: '#9e7a8c', textAlign: 'center' }}>
          typing your situation and reading your set stay free. always.
        </div>
      </div>
      <style>{`@keyframes shutapUpIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
    </div>
  )
}
