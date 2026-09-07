/* The deck, as a state machine.
 *
 * Three cards, face-down, in a shuffled order. What a tier buys is how many of
 * them you may turn over — never how many you may read, because a card you
 * turned over stays readable forever at every tier.
 *
 * The backs go up the moment the set opens, before the cards are written: a
 * back is label and subtitle only, so it needs nothing from the writer. That is
 * what makes the flip the latency budget rather than a spinner — turn one over
 * early and it holds on its mid-flip edge until the words land.
 *
 * Shared by the live surface and the design page so both walk the identical
 * machine, and there is only one place where "spent" is defined. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FLIPS_PER_SET, SLOTS, shuffleSlots, type JokeTier, type SlotKey } from '@/lib/jokes/deck'
import { HALF_TURN, prefersReducedMotion } from './FlipCard'

/** `hold` is the mid-flip wait; `edge` is the one frame where content swaps. */
export type DeckPhase = 'front' | 'out' | 'hold' | 'edge' | 'in'

/** Anyone with an alias turns over all three. A guest turns over one; the
 *  two left face-down are the sign-up wall — visible, labelled, and not
 *  theirs to turn until they have a name. */
export function flipsAllowed(tier: JokeTier): number {
  return Math.min(SLOTS.length, FLIPS_PER_SET[tier])
}

export function useDeck({
  seed,
  tier,
  /** Which slots have their text yet. A flip started before its card is
   *  written waits at the edge for this to include it. */
  written,
  /** The deal gave up; release anything still waiting rather than hold forever. */
  failed = false,
  onFirstFlip,
  onReveal,
  onSpentTap,
}: {
  seed: string
  tier: JokeTier
  written: ReadonlySet<string>
  failed?: boolean
  onFirstFlip?: (slot: SlotKey, position: number) => void
  onReveal?: (slot: SlotKey, position: number) => void
  onSpentTap?: (slot: SlotKey) => void
}) {
  const [phases, setPhases] = useState<Partial<Record<SlotKey, DeckPhase>>>({})
  const [pulsing, setPulsing] = useState(false)
  const timers = useRef<number[]>([])
  const flipCount = useRef(0)

  useEffect(() => {
    const held = timers.current
    return () => held.forEach((t) => window.clearTimeout(t))
  }, [])

  // A new situation deals a new set: everything face-down again — and no
  // half-turn still in flight from the last set may land on this one, or a
  // card ends up parked on its edge, invisible, before anyone touched it.
  useEffect(() => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    setPhases({})
    setPulsing(false)
    flipCount.current = 0
  }, [seed])

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }, [])

  const order = useMemo(() => shuffleSlots(SLOTS, seed), [seed])

  const phaseOf = useCallback((slot: SlotKey): DeckPhase => phases[slot] ?? 'front', [phases])
  const set = useCallback(
    (slot: SlotKey, phase: DeckPhase) => setPhases((prev) => ({ ...prev, [slot]: phase })),
    [],
  )

  const used = useMemo(
    () => Object.values(phases).filter((p) => p && p !== 'front').length,
    [phases],
  )
  const allowed = flipsAllowed(tier)

  /** Face-down with no flips left. The card itself does not change — this only
   *  says that tapping it points at the offer instead of turning it over. */
  const isSpent = useCallback(
    (slot: SlotKey) => phaseOf(slot) === 'front' && used >= allowed,
    [phaseOf, used, allowed],
  )

  const land = useCallback(
    (slot: SlotKey, position: number) => {
      set(slot, 'edge')
      later(() => set(slot, 'in'), 30)
      onReveal?.(slot, position)
    },
    [set, later, onReveal],
  )

  const tap = useCallback(
    (slot: SlotKey) => {
      if (phaseOf(slot) !== 'front') return
      const position = order.findIndex((s) => s.key === slot)

      if (used >= allowed) {
        // The spent state, entire: the card is untouched, the offer pulses.
        onSpentTap?.(slot)
        setPulsing(true)
        later(() => setPulsing(false), 1400)
        return
      }

      flipCount.current += 1
      // The highest-signal event in the product — which of the three someone
      // reaches for first, with the position it happened to be sitting in.
      if (flipCount.current === 1) onFirstFlip?.(slot, position)

      const ready = written.has(slot)
      if (prefersReducedMotion()) {
        if (ready) land(slot, position)
        else set(slot, 'hold')
        return
      }
      set(slot, 'out')
      later(() => {
        if (written.has(slot)) land(slot, position)
        else set(slot, 'hold')
      }, HALF_TURN)
    },
    [phaseOf, order, used, allowed, written, onSpentTap, onFirstFlip, later, land, set],
  )

  // A card turned over before it was written finishes turning when it lands.
  useEffect(() => {
    for (const slot of order) {
      if (phases[slot.key] !== 'hold') continue
      if (written.has(slot.key)) land(slot.key, order.findIndex((s) => s.key === slot.key))
      else if (failed) set(slot.key, 'front')
    }
  }, [phases, written, failed, order, land, set])

  const revealedSlots = useMemo(
    () => order.filter((s) => phaseOf(s.key) === 'edge' || phaseOf(s.key) === 'in'),
    [order, phaseOf],
  )

  return { order, phaseOf, tap, isSpent, used, allowed, pulsing, revealedSlots }
}
