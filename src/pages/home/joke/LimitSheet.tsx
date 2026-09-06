/* The limit, said plainly.
 *
 * Goes up the moment someone presses enter on a spent day — before the spill
 * is sent anywhere, so no scrubber, classifier or writer runs for a set the
 * deal would only refuse. It says what the limit is, when it resets, and what
 * the next step buys: a guest is pointed at an alias (every card kept, and
 * the door to the members' deck), and everyone under paying is shown the
 * members' offer after that — three situations a day, all three cards turned
 * over, stated as what they are. A paying member is at the top of that
 * ladder, so their copy is a reset time and nothing else. */
import type { JokeTier, JokeUsage, LimitReason } from '@/lib/jokes/deck'
import { Button, CompanionLine, Sheet, SORA, NEWS, INK, MUTED, FAINT, ACCENT } from './ui'

export type LimitSheetReason = LimitReason | 'rate_limited'

function resetLabel(usage: JokeUsage | null): string {
  const t = usage ? Date.parse(usage.resets_at) : NaN
  if (!Number.isFinite(t)) return 'tomorrow'
  const d = new Date(t)
  const sameDay = d.toDateString() === new Date().toDateString()
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return sameDay ? `at ${time}` : `tomorrow at ${time}`
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const word = (n: number) => WORDS[n] ?? String(n)

function copy(tier: JokeTier, reason: LimitSheetReason, usage: JokeUsage | null): { lead: string; body: string } {
  const reset = resetLabel(usage)
  if (reason === 'rate_limited') {
    return {
      lead: 'easy — a lot of jokes have come off this connection.',
      body: `not you, the network. give it a little while and the deck is back. the cards you already have stay right here.`,
    }
  }
  const sets = word(usage?.sets_cap ?? (tier === 'paying' ? 3 : 2))
  if (tier === 'guest') {
    return {
      lead: `that's the deck for today — ${sets} situations.`,
      body: `it resets ${reset}. an alias — a fake one, thirty seconds — keeps every card you turn over. members get three situations a day, turn over all three cards of each, and save them with no mark.`,
    }
  }
  if (tier === 'free') {
    return {
      lead: `that's the deck for today — ${sets} situations.`,
      body: `it resets ${reset}. members get three situations a day, turn over all three cards of each, and save them clean and four times bigger.`,
    }
  }
  return {
    lead: `that's the whole deck for today — ${sets} situations.`,
    body: `i wrote every card of it. the deck resets ${reset}, and your set list is right here in the meantime.`,
  }
}

export function LimitSheet({
  open,
  tier,
  reason,
  usage,
  onClose,
  onAlias,
  onUpgrade,
}: {
  open: boolean
  tier: JokeTier
  reason: LimitSheetReason
  usage: JokeUsage | null
  onClose: () => void
  /** guest → the alias gate, and the members' offer after it */
  onAlias: () => void
  /** free → the members' offer */
  onUpgrade: () => void
}) {
  const { lead, body } = copy(tier, reason, usage)
  const throttled = reason === 'rate_limited'
  const used = usage ? Math.min(usage.sets_used, usage.sets_cap) : null

  return (
    <Sheet open={open} onClose={onClose}>
      <CompanionLine size={32}>
        <strong style={{ fontStyle: 'normal', fontFamily: SORA, fontWeight: 700, fontSize: 18, color: INK }}>
          {lead}
        </strong>
        <br />
        {body}
      </CompanionLine>

      {!throttled && usage ? (
        <div
          aria-label={`${used} of ${usage.sets_cap} situations used today`}
          style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fdfbf9', border: '1px solid rgba(11,8,15,.08)', borderRadius: 16, padding: '12px 14px' }}
        >
          <span aria-hidden style={{ display: 'flex', gap: 5 }}>
            {Array.from({ length: usage.sets_cap }, (_, i) => (
              <span key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: i < (used ?? 0) ? ACCENT : 'rgba(11,8,15,.1)' }} />
            ))}
          </span>
          <span style={{ fontFamily: SORA, fontSize: 12.5, color: MUTED }}>
            {used} of {usage.sets_cap} situations today · resets {resetLabel(usage)}
          </span>
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!throttled && tier === 'guest' ? (
          <>
            <Button onClick={onAlias} full>get my alias — it&apos;s free</Button>
            <Button variant="secondary" onClick={onUpgrade} full>see what members get</Button>
          </>
        ) : null}
        {!throttled && tier === 'free' ? (
          <Button onClick={onUpgrade} full>see clean cards</Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onClose} full>
          {throttled ? 'okay' : tier === 'paying' ? 'okay — back tomorrow' : 'not now — keep reading'}
        </Button>
      </div>

      <div style={{ fontFamily: NEWS, fontStyle: 'italic', fontSize: 13.5, color: FAINT, textAlign: 'center' }}>
        {throttled
          ? 'nothing was written, nothing was charged.'
          : 'reading the cards you already have stays free either way.'}
      </div>
    </Sheet>
  )
}
