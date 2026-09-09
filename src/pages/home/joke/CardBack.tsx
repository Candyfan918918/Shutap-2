/* A card, face-down.
 *
 * Designed like the face and painted from the same constants — same ground,
 * same aura, same grain, same eyes-and-wordmark lockup in the same corner — so
 * turning one over reads as one object rotating, not as two different cards.
 *
 * What it shows is the slot label and its subtitle, and nothing else. The
 * subtitle is permanent rather than a tooltip: a guest is making their single
 * most important choice on their first visit and cannot be asked to discover
 * what "the take" means.
 *
 * All three backs are identical apart from that text — same surface, same
 * weight, no per-slot glyph, no per-slot accent. If the roast back looked
 * louder than the take back the choice would be biased, and the first-flip
 * distribution this deck exists to measure would be worthless. */
import { useState } from 'react'
import {
  CARD_EDGE,
  CARD_FAINT,
  CARD_GRAIN,
  CARD_GROUND,
  CARD_INK,
  CARD_INK_2,
  CARD_SHADOW,
  CARD_SHADOW_HOVER,
  CardLockup,
} from './ui'

export function CardBack({
  label,
  subtitle,
  situation,
  /** Mid-flip, waiting on the writer: a quiet hold, never a spinner. */
  holding = false,
  interactive = true,
}: {
  label: string
  subtitle: string
  situation?: string
  holding?: boolean
  interactive?: boolean
}) {
  const [hover, setHover] = useState(false)
  return (
    <div style={{ containerType: 'inline-size', width: '100%' }}>
      <div
        onMouseEnter={interactive ? () => setHover(true) : undefined}
        onMouseLeave={interactive ? () => setHover(false) : undefined}
        style={{
          position: 'relative', width: '100%', aspectRatio: '9/16',
          borderRadius: '7cqw', overflow: 'hidden',
          background: CARD_GROUND, border: CARD_EDGE,
          boxShadow: hover ? CARD_SHADOW_HOVER : CARD_SHADOW,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '7cqw 6.5cqw', color: CARD_INK,
          // A lift on hover, and nothing else. No rotation, no glow — a back
          // that reacts more than that starts advertising itself.
          transform: hover ? 'translateY(-3px)' : 'none',
          transition: 'box-shadow .3s cubic-bezier(.2,.8,.2,1), transform .3s cubic-bezier(.2,.8,.2,1)',
          animation: holding ? 'shutapHold .9s ease-in-out infinite' : 'none',
        }}
      >
        <div
          className="shutap-card-aura"
          style={{
            position: 'absolute', width: '150%', height: '58%', left: '-25%', top: '6%',
            background: 'radial-gradient(circle,rgba(231,84,138,.3),transparent 66%)',
            filter: 'blur(10px)', pointerEvents: 'none',
          }}
        />
        <div style={CARD_GRAIN} />

        <CardLockup />

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '2.6cqw' }}>
          <span style={{ font: '800 9.6cqw/1.08 Sora,sans-serif', letterSpacing: '-.035em', color: CARD_INK }}>
            {label}
          </span>
          <span style={{ font: 'italic 400 5cqw/1.35 Newsreader,serif', color: CARD_INK_2, textWrap: 'pretty' }}>
            {subtitle}
          </span>
          {holding ? (
            // Said in words as well as shown, so a held card is never mistaken
            // for a broken one: it is being written, and it will turn.
            <span aria-live="polite" style={{ font: '500 4.2cqw/1.4 Inter,sans-serif', color: CARD_INK_2, letterSpacing: '.02em', marginTop: '1.5cqw' }}>
              writing this one…
            </span>
          ) : null}
        </div>

        <span style={{ position: 'relative', font: '400 4.2cqw/1.45 Inter,sans-serif', color: CARD_FAINT, textWrap: 'pretty' }}>
          {situation}
        </span>
      </div>
    </div>
  )
}

/* The aura breathes and the hold pulses; both stop for reduced motion. Kept
   with the deck rather than in global.css — nothing else on the site draws a
   card back. */
export function CardBackStyles() {
  return (
    <style>{`
      .shutap-card-aura{animation:breathe 6.5s ease-in-out infinite}
      @keyframes shutapHold{0%,100%{opacity:.55}50%{opacity:1}}
      @media (prefers-reduced-motion: reduce){
        .shutap-card-aura{animation:none;opacity:.7}
      }
    `}</style>
  )
}
