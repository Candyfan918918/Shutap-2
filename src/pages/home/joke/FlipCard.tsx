/* The flip.
 *
 * The whole card is the hit target, and the animation is the latency budget:
 * the card is being written while it turns. It is deliberately not short —
 * nobody notices 450ms, everybody notices a weak card — and it never becomes a
 * spinner, a skeleton or a percentage. If the writer runs past the turn, the
 * card holds on its mid-flip edge with a quiet pulse until the fallback lands.
 *
 * Mechanically it is a half-turn out, a swap at the edge, and a half-turn back
 * in, which is why the phases below are `out` → `edge` → `in` rather than a
 * single rotation: swapping the content at the halfway point is what makes the
 * two faces read as two sides of one card.
 *
 * The hold is NOT the edge. A card at exactly 90° has no width, so a reader
 * who turned it over before it was written watched it vanish and took the
 * deck for two cards. Held, it turns most of the way and stops there, back
 * still showing, pulsing — visibly a card mid-turn, waiting. */
import type { ReactNode } from 'react'

/** `edge` is one frame wide — the card sits at -90°, content already swapped,
 *  with the transition suppressed so it doesn't animate back through zero.
 *  The phases are driven by useDeck, which owns the flip budget. */
export type FlipPhase = 'front' | 'out' | 'hold' | 'edge' | 'in'

/** Where a held card stops: most of the way round, still plainly a card. */
const HOLD_ANGLE = 58

/** Half a turn. The whole flip is two of these, ~450ms, ease-out. */
export const HALF_TURN = 225

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function FlipCard({
  phase,
  onTap,
  label,
  hint,
  spent,
  describedBy,
  children,
}: {
  phase: FlipPhase
  onTap: () => void
  /** The revealed line once it exists, so the button announces what it turned
   *  into rather than what it used to be. */
  label: string
  hint: string
  spent: boolean
  describedBy?: string
  children: ReactNode
}) {
  const revealed = phase === 'edge' || phase === 'in'
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={revealed ? `${label} — ${hint}` : `flip ${label} — ${hint}`}
      // Spent cards stay tappable: the tap is what points at the paywall.
      // aria-disabled says "this will not turn over", which is true, without
      // taking the control out of the tab order and stranding the pointer.
      aria-disabled={spent ? true : undefined}
      aria-describedby={spent ? describedBy : undefined}
      style={{
        all: 'unset', boxSizing: 'border-box', display: 'block', width: '100%',
        cursor: 'pointer', perspective: 1200, WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div
        style={{
          transform:
            phase === 'out'
              ? 'rotateY(90deg)'
              : phase === 'hold'
                ? `rotateY(${HOLD_ANGLE}deg)`
                : phase === 'edge'
                  ? 'rotateY(-90deg)'
                  : 'rotateY(0deg)',
          // No transition across the edge, or the card would animate the swap
          // back through the front it just left.
          transition: phase === 'edge' ? 'none' : `transform ${HALF_TURN}ms cubic-bezier(.2,.8,.2,1)`,
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </button>
  )
}
