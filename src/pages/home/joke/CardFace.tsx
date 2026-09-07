/* One joke card, as it looks on screen.
 *
 * This is the same composition the export renders, at the same 9:16 — so what
 * someone saves is what they were just looking at, the mark included. Sizes
 * are container-query units against the card's own width, which is what keeps
 * the deck, the export preview and a phone-width column all in proportion. */
import type { JokeCard } from '@/lib/jokes/deck'
import { angleAccent } from '@/lib/jokes/deck'
import {
  CARD_EDGE,
  CARD_FAINT,
  CARD_GRAIN,
  CARD_GROUND,
  CARD_INK,
  CARD_SHADOW,
  CardLockup,
  lift,
} from './ui'

export function CardFace({
  card,
  situation,
  mark,
  loading = false,
}: {
  card: JokeCard
  /** Omitted wherever the situation already stands above the card. In the set
   *  list one line heads a whole group, so printing it again on each of three
   *  cards is the same sentence three times. */
  situation?: string
  mark: boolean
  loading?: boolean
}) {
  const accent = angleAccent(card.angle)
  return (
    // The container is the wrapper, not the card: cqw resolves against the
    // nearest ANCESTOR container's content box, so a card that is its own
    // container sizes its radius and padding off the viewport instead.
    <div style={{ containerType: 'inline-size', width: '100%' }}>
    <div
      style={{
        position: 'relative', width: '100%', aspectRatio: '9/16',
        borderRadius: '7cqw', overflow: 'hidden',
        background: CARD_GROUND, border: CARD_EDGE, boxShadow: CARD_SHADOW,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '7cqw 6.5cqw', color: CARD_INK,
      }}
    >
      <div style={{ position: 'absolute', width: '150%', height: '44%', left: '-25%', top: '14%', background: `radial-gradient(circle,${accent}4d,transparent 66%)`, filter: 'blur(4px)', pointerEvents: 'none' }} />
      <div style={CARD_GRAIN} />

      {mark ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '9cqw', transform: 'rotate(-22deg)', pointerEvents: 'none', opacity: 0.085 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ font: '800 13cqw/1 Sora,sans-serif', letterSpacing: '-.04em', whiteSpace: 'nowrap', color: '#fff', textAlign: 'center' }}>
              shutap · shutap
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '2cqw 4cqw', minWidth: 0 }}>
        <CardLockup />
        <span
          style={{
            font: '800 4.2cqw/1 Sora,sans-serif', letterSpacing: '.28em', textTransform: 'uppercase',
            // The slot label persists after the reveal so a screenshot carries
            // the frame — which makes it load-bearing, so it clears 4.5:1.
            color: lift(accent, 0.34),
          }}
        >
          {card.angleLabel}
        </span>
      </div>

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '4cqw' }}>
        {situation ? (
          <div style={{ font: '400 4.4cqw/1.45 Inter,sans-serif', color: CARD_FAINT, maxWidth: '26ch' }}>
            {situation}
          </div>
        ) : null}
        <div style={{ font: 'italic 400 8cqw/1.32 Newsreader,serif', letterSpacing: '-.01em', color: CARD_INK, textWrap: 'pretty', opacity: loading ? 0.35 : 1, transition: 'opacity .25s' }}>
          {loading ? 'shuffling…' : card.text}
        </div>
      </div>

      {/* One quiet line, and no pills. The mark a guest's card carries is the
          diagonal wash above, which belongs to the image — a corner badge would
          be chrome the screenshot has to explain. */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '3cqw' }}>
        <span style={{ font: 'italic 400 4.4cqw/1 Newsreader,serif', color: CARD_FAINT }}>said it on shutap.com</span>
      </div>
    </div>
    </div>
  )
}
