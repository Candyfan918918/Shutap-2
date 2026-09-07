/* Your cards, newest first.
 *
 * A kept card is shown AS A CARD — the same 9:16 artifact the deck deals and
 * the export saves, so what you scroll past here is what you would send
 * someone. It used to be a text row, which made a kept card read like a
 * quotation of itself rather than the thing you kept.
 *
 * The situation heads the group once and is left off the cards under it: all
 * three were written for the same line, and printing it on each is the same
 * sentence three times. That is the one way these differ from a card in the
 * deck, where nothing sits above it to carry the context.
 *
 * Unflipped positions are not shown, at any tier. A card that was never
 * flipped was never written and does not exist: no ghost rows, no blurred
 * teasers, no "2 more". The free tier renders completely at its own depth.
 *
 * Shared by the joke surface and the profile's cards tab, so the two cannot
 * drift into two different ideas of what a kept card looks like. */
import type { JokeCard } from '@/lib/jokes/deck'
import { CardFace } from './CardFace'
import { Eyebrow, MUTED, NEWS, SORA, FAINT } from './ui'

export type SetGroup = { id: string; situation: string; cards: JokeCard[] }

/** "today" on the day, then plain days. Anything older is still a number —
 *  a set list is read by how long ago, not by date. */
function timeAgo(day?: string): string {
  if (!day) return 'just now'
  const d = Math.round((Date.now() - new Date(day + 'T12:00:00').getTime()) / 86400000)
  return d <= 0 ? 'today' : `${d}d`
}

export function SetList({
  groups,
  /** The diagonal shutap wash — everyone but a member carries it. */
  mark = true,
  onShare,
  onDownload,
}: {
  groups: SetGroup[]
  mark?: boolean
  /** Omit both and the cards render without an action row — the list is then
   *  a record to read rather than a place to act. */
  onShare?: (card: JokeCard) => void
  onDownload?: (card: JokeCard) => void
}) {
  if (!groups.length) return null
  const acts = !!(onShare || onDownload)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {groups.map((group) => (
        <div
          key={group.id}
          style={{
            display: 'flex', flexDirection: 'column', gap: 12,
            background: '#fff', border: '1px solid rgba(11,8,15,.08)',
            borderRadius: 22, padding: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ flex: 1, minWidth: 0, fontFamily: NEWS, fontStyle: 'italic', fontSize: 15, lineHeight: 1.45, color: MUTED, textWrap: 'pretty' }}>
              {group.situation}
            </span>
            <span
              style={{
                flex: 'none', fontFamily: SORA, fontWeight: 600, fontSize: 10.5,
                letterSpacing: '.14em', textTransform: 'uppercase', color: FAINT, whiteSpace: 'nowrap',
              }}
            >
              {timeAgo(group.cards[0]?.day)} · {group.cards.length}{' '}
              {group.cards.length === 1 ? 'card' : 'cards'}
            </span>
          </div>

          {/* One card sits at its own width rather than stretching across the
              row — a 9:16 card blown up to full width is a poster, not a card. */}
          <div
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
              justifyContent: 'start', gap: 14, alignItems: 'start',
            }}
          >
            {group.cards.map((card) => (
              <div
                key={card.id ?? `${group.id}-${card.position}`}
                style={{ display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0, maxWidth: 340, width: '100%' }}
              >
                <CardFace card={card} mark={mark} />

                {acts ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {card.room_id ? (
                      <Eyebrow style={{ fontSize: 10, letterSpacing: '.14em', color: '#8e1c4c', marginRight: 'auto' }}>
                        ◎ in a room
                      </Eyebrow>
                    ) : null}
                    {onShare ? <RowButton onClick={() => onShare(card)}>share</RowButton> : null}
                    {onDownload ? <RowButton onClick={() => onDownload(card)}>download</RowButton> : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** The quiet action pill from the deck's card row, so a kept card offers the
 *  same two things in the same shape wherever it is read. */
function RowButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
        height: 36, padding: '0 14px', borderRadius: 999, cursor: 'pointer',
        background: 'transparent', border: '1px solid rgba(11,8,15,.08)', color: MUTED,
        fontFamily: SORA, fontWeight: 800, fontSize: 12, lineHeight: 1,
      }}
    >
      {children}
    </button>
  )
}
