// Client-safe joke-card vocabulary. No authored content, no prompts here —
// those live in deck.server.ts so the fallback pools never ship to a browser.

/* ─────────────────────────── the three slots ───────────────────────────
   Three cards, always, in this order: the take, the clapback, the roast.
   Everybody gets the same three — what changes between tiers is what you
   are allowed to DO with them, never how many you may read. */

export type SlotKey = 'the_take' | 'the_clapback' | 'the_roast'

/* `subtitle` is what the card BACK shows under the label, and it is permanent
   rather than a tooltip: a guest makes their single most important choice on
   their first visit, so they cannot be required to discover what "the take"
   means. `brief` is for the model; `subtitle` is for the reader. */
export const SLOTS: { key: SlotKey; label: string; subtitle: string; brief: string; accent: string }[] = [
  {
    key: 'the_take',
    label: 'the take',
    subtitle: 'what actually happened here',
    brief: 'name what actually happened, drily, the way a friend would say it back to her',
    accent: '#e7548a',
  },
  {
    key: 'the_clapback',
    label: 'the clapback',
    subtitle: "what you wish you'd said",
    brief: 'the line she wishes she had said in the moment — one sentence, in quotes',
    accent: '#c1216b',
  },
  {
    key: 'the_roast',
    label: 'the roast',
    subtitle: 'the joke',
    brief: 'roast the object or the move itself — the chart, the sigh, the rule — never the person',
    accent: '#7F77DD',
  },
]

export const SLOT_KEYS: SlotKey[] = SLOTS.map((s) => s.key)

/* ── legacy vocabulary ──
   Cards written before the deck settled on three slots carry one of these
   seven angles. Nothing generates them any more, but stored rows still read
   back through the label/accent lookups below. */
export const ANGLES: [slug: string, label: string, brief: string][] = [
  ['target_the_behavior', 'the behaviour', 'roast the specific thing they did'],
  ['target_the_guilt_trip', 'the guilt trip', 'roast the manipulation move'],
  ['target_the_double_standard', 'the double standard', 'roast the rule that applies to her and not to them'],
  ['target_the_timing', 'the timing', 'roast when they chose to do it'],
  ['absurdist_escalation', 'the escalation', 'extrapolate the behaviour to something ridiculous'],
  ['deadpan_understatement', 'the deadpan', 'the flattest possible statement of the absurdity'],
  ['the_comeback', 'the comeback', 'the line she wishes she had said in the moment'],
]

export const ANGLE_LABEL: Record<string, string> = {
  ...Object.fromEntries(ANGLES.map((a) => [a[0], a[1]])),
  ...Object.fromEntries(SLOTS.map((s) => [s.key, s.label])),
}

const ACCENTS: Record<string, string> = {
  ...Object.fromEntries(SLOTS.map((s) => [s.key, s.accent])),
  target_the_behavior: '#e7548a',
  target_the_guilt_trip: '#c87c4a',
  target_the_double_standard: '#c1216b',
  target_the_timing: '#c87c4a',
  absurdist_escalation: '#7F77DD',
  deadpan_understatement: '#7F77DD',
  the_comeback: '#c1216b',
}

export function angleLabel(angle: string): string {
  return ANGLE_LABEL[angle] ?? angle
}

const SUBTITLES: Record<string, string> = Object.fromEntries(
  SLOTS.map((s) => [s.key, s.subtitle]),
)

/** The permanent line under a back's label. Empty for the legacy angles,
 *  which predate the labelled backs and are only ever read back revealed. */
export function angleSubtitle(angle: string): string {
  return SUBTITLES[angle] ?? ''
}

/* ─────────────────────── the shuffle ───────────────────────
   Position is randomised per set. The label carries the identity, so position
   doesn't need to — and randomising is what keeps `first_flip_slot` free of a
   positional confound, which is the one number this deck exists to measure.

   Seeded off the set id rather than Math.random so a re-render, a remount or
   a second tab all deal the same set in the same order. */

function hash(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h || 1
}

export function shuffleSlots<T>(items: readonly T[], seed: string): T[] {
  const out = items.slice()
  let state = hash(seed)
  for (let i = out.length - 1; i > 0; i--) {
    // xorshift32, so successive draws in one pass don't correlate
    state ^= state << 13; state >>>= 0
    state ^= state >>> 17
    state ^= state << 5; state >>>= 0
    const j = state % (i + 1)
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

export function angleAccent(angle: string): string {
  return ACCENTS[angle] ?? '#e7548a'
}

export const ARCHETYPE_LABEL: Record<string, string> = {
  uninvited_visitor: 'Uninvited Visitor',
  backhanded_grandma: 'Backhanded Grandma',
  boundary_bulldozer: 'Boundary Bulldozer',
  favoritism_broadcaster: 'Favoritism Broadcaster',
  grandbaby_countdown_clock: 'Grandbaby Countdown Clock',
  silent_treatment_strategist: 'Silent Treatment Strategist',
  general: 'general',
}

export type JokeCard = {
  id: string | null
  position: number
  angle: string
  angleLabel: string
  text: string
  used_fallback: boolean
  judge_score: number | null
  saved: boolean
  room_id?: string | null
  day?: string
  /** The set list groups by these: a card is read back under the situation
   *  it was written for, never as a loose line. */
  set_id?: string | null
  situation?: string
}

export type JokeTier = 'guest' | 'free' | 'paying'

/* ─────────────────────────── the ladder ───────────────────────────
   One place for the numbers every sheet, page and policy quotes. The server
   enforces them (jokes.functions.ts reads DAILY_SETS; useDeck reads
   FLIPS_PER_SET); the copy below only describes them. */

/** situations a day */
export const DAILY_SETS: Record<JokeTier, number> = { guest: 1, free: 1, paying: 3 }
/** cards turned over per situation (of three). A guest turns over one; the
 *  other two stay face-down behind the alias — that is the sign-up wall, and
 *  it is a strong one because they can see the two labelled backs they
 *  cannot turn. An alias turns over all three. */
export const FLIPS_PER_SET: Record<JokeTier, number> = { guest: 1, free: 3, paying: 3 }

/** What a membership buys, stated as behaviour. */
export const MEMBER_BENEFITS: { line: string; detail: string }[] = [
  { line: 'three situations a day, not one', detail: 'the deck resets every day in your own timezone.' },
  { line: 'exports with no shutap mark', detail: 'free cards carry a small mark in the corner; yours are clean.' },
  { line: '2160×3840 — print-size', detail: 'four times the pixels of a free export.' },
  { line: 'the mirror reading — what your situations keep saying', detail: 'everything you keep goes into a private record it reads patterns back from.' },
]


/** What never costs anything, at any tier. */
export const ALWAYS_FREE = [
  'typing what happened, with identifying details scrubbed first',
  'one situation a day — flip one card as a guest, all three with an alias',
  'reading the cards you flipped, for as long as you like',
  'sharing or saving the card you flipped, with the shutap mark',
]

/* ─────────────────────────── the two asks ───────────────────────────
   Every button and every offer line on this surface says one of these two
   things, in these words. A guest is asked for an alias, and what the alias
   buys is FLIPPING ALL THREE. An alias is asked for a membership, and what
   the membership buys is THE MIRROR READING — with the joke-card room and
   pixels named alongside it, so the offer is never only the mirror. */

export const ALIAS_OFFER = {
  cta: 'flip all three — free',
  /** "an alias flips all three, and keeps them." */
  line: 'an alias flips all three, and keeps them.',
}

export const MEMBER_OFFER = {
  cta: 'open the mirror reading',
  /** what a membership buys, in one breath — cards first, then the mirror */
  line: 'three situations a day, every set kept clean — no mark, print-size 2160×3840 — and the mirror reading the patterns across all of it.',
}

/** The one place the member ask is worded differently: the day's deck is
 *  spent, so what they are reaching for is more jokes, not the mirror. Same
 *  offer line underneath; the pill names the thing they just ran out of, and
 *  it goes straight to checkout — no upgrade screen in between. */
export const LIMIT_OFFER = {
  cta: 'get more jokes',
}

/* ─────────────────────── the daily budget, as the client sees it ───────────────────────
   Resolved and enforced on the server; the browser only carries a copy so it
   can say "that's today's lot" the moment someone presses enter, instead of
   sending a spill off to be scrubbed, classified and written for nothing. */

export type JokeUsage = {
  /** cards written today — a deal costs three */
  cards_used: number
  cards_cap: number
  /** situations opened today */
  sets_used: number
  sets_cap: number
  /** ISO instant the counter rolls over, in the caller's own day */
  resets_at: string
}

export type LimitReason = 'daily_sets' | 'daily_cards'

/** Why the next deal would be refused, or null while there is room for one. */
export function usageBlock(u: JokeUsage | null | undefined): LimitReason | null {
  if (!u) return null
  if (u.sets_used >= u.sets_cap) return 'daily_sets'
  if (u.cards_used + 3 > u.cards_cap) return 'daily_cards'
  return null
}

/** A copy of the counter is only worth consulting before it rolls over. */
export function usageIsCurrent(u: JokeUsage | null | undefined, now = Date.now()): boolean {
  if (!u) return false
  const t = Date.parse(u.resets_at)
  return Number.isFinite(t) && now < t
}

/* ─────────────────────────── what money buys ───────────────────────────
   Pixels, and only pixels. Reading the cards is free at every tier; the
   paid difference is the absent mark and the print-size export. Guests may
   read but not export at all — that is the alias gate, not the paywall. */

export type ExportSpec = {
  width: number
  height: number
  mark: boolean
  /** "1080×1920 · includes the shutap mark" — shown under the save button. */
  note: string
}

export const EXPORT: Record<Exclude<JokeTier, 'guest'>, ExportSpec> = {
  free: {
    width: 1080,
    height: 1920,
    mark: true,
    note: '1080×1920 · includes the shutap mark',
  },
  paying: {
    width: 2160,
    height: 3840,
    mark: false,
    note: 'clean · 2160×3840 · no mark on any of them',
  },
}

export function exportSpec(tier: JokeTier): ExportSpec {
  return tier === 'paying' ? EXPORT.paying : EXPORT.free
}
