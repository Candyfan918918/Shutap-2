// Joke cards — the landing surface's server side.
//
// The shape of the flow, and the reason it is shaped this way:
//   · three cards, always — the take, the clapback, the roast. Everybody gets
//     the same three. READING THEM IS FREE AT EVERY TIER, guests included.
//   · the only wall a guest hits is the alias gate, and it stands in front of
//     SAVING and SHARING, never in front of reading.
//   · money buys pixels and room: no mark, print-size, the set in one tap,
//     three situations a day with all three cards turned over. It never buys
//     relief.
//   · crisis overrides all of it — no cards, no gate, no paywall.
//
// Every rule that matters is enforced here, never in the browser:
//   · identity + tier resolved from the bearer token and the subscriptions table
//   · the daily generation counter incremented BEFORE any model call, so a
//     crash mid-generation cannot hand out free generations
//   · guest cards are returned but never written to joke_cards
//   · signing in merges today's counter instead of minting a fresh allowance
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { runScrub } from './agents/scrubber.functions'
import { runClassifyCrisis } from './agents/guard.functions'
import { classifyArchetype, dealSlots, generateLine } from './jokes/deck.server'
import { resolveJokeIdentity, resolveDay, resolveDayInfo, ipFlipLimit, ipSubjectKey } from './jokes/session.server'
import {
  angleLabel,
  angleAccent,
  exportSpec,
  usageBlock,
  type JokeCard,
  type JokeTier,
  type JokeUsage,
  type LimitReason,
} from './jokes/deck'
import { renderCardSvg, cardFilename } from './jokes/card-art'

const Ctx = {
  anon_session_id: z.string().max(64).nullable().optional(),
  // Accepted but DELIBERATELY IGNORED: the day comes from server-stored state
  // only, so a client cannot roll its own timezone to farm extra generations.
  timezone: z.string().max(64).nullable().optional(),
}

type FlipRow = {
  subject_key: string
  day: string
  /** cards generated today — the deal costs three, each reroll costs one */
  flips_used: number
  sets_flipped: number
  set_ids: string[]
}

/* ── the daily generation budget ──
   Situations a day, and the three cards each one costs. A guest and a free
   alias get the same two — the alias buys keeping and sharing, not room.
   Members get three, and (see flipsAllowed) turn over all three cards of
   every one of them. The members' cap is tunable with JOKE_DAILY_SETS /
   JOKE_DAILY_CARDS. */
type Budget = { cards: number; sets: number }

const DAILY: Record<JokeTier, Budget> = {
  guest: { cards: 6, sets: 2 },
  free: { cards: 6, sets: 2 },
  paying: { cards: 9, sets: 3 },
}

function budget(tier: JokeTier): Budget {
  const cards = Number(process.env['JOKE_DAILY_CARDS'] ?? '')
  const sets = Number(process.env['JOKE_DAILY_SETS'] ?? '')
  const base = DAILY[tier]
  if (tier !== 'paying') return base
  return {
    cards: Number.isFinite(cards) && cards > 0 ? Math.floor(cards) : base.cards,
    sets: Number.isFinite(sets) && sets > 0 ? Math.floor(sets) : base.sets,
  }
}

async function readCounter(admin: any, subjectKey: string, day: string): Promise<FlipRow> {
  const { data } = await admin
    .from('joke_flips')
    .select('subject_key, day, flips_used, sets_flipped, set_ids')
    .eq('subject_key', subjectKey)
    .eq('day', day)
    .maybeSingle()
  return (data as FlipRow | null) ?? { subject_key: subjectKey, day, flips_used: 0, sets_flipped: 0, set_ids: [] }
}

/** Today's counter against today's cap, in the shape the browser keeps. */
function usageOf(tier: JokeTier, counter: FlipRow, resetsAt: string): JokeUsage {
  const cap = budget(tier)
  return {
    cards_used: counter.flips_used,
    cards_cap: cap.cards,
    sets_used: counter.sets_flipped,
    sets_cap: cap.sets,
    resets_at: resetsAt,
  }
}

/** Has the coarse per-network layer already been spent today? Read-only. */
async function networkSpent(admin: any, day: string): Promise<boolean> {
  const ipKey = ipSubjectKey()
  if (!ipKey) return false
  const row = await readCounter(admin, ipKey, day)
  return row.flips_used >= ipFlipLimit()
}

/** Charge the counter BEFORE generating, so a crash cannot refund itself. */
async function charge(
  admin: any,
  subjectKey: string,
  day: string,
  counter: FlipRow,
  cost: number,
  setId: string,
): Promise<void> {
  const counted = counter.set_ids.includes(setId)
  await admin.from('joke_flips').upsert(
    {
      subject_key: subjectKey,
      day,
      flips_used: counter.flips_used + cost,
      sets_flipped: counted ? counter.sets_flipped : counter.sets_flipped + 1,
      set_ids: counted ? counter.set_ids : [...counter.set_ids, setId],
    } as never,
    { onConflict: 'subject_key,day' },
  )
}

/** The coarse per-network layer, independent of the tier rules. */
async function chargeNetwork(admin: any, day: string, cost: number): Promise<'ok' | 'limited'> {
  const ipKey = ipSubjectKey()
  if (!ipKey) return 'ok'
  const row = await readCounter(admin, ipKey, day)
  if (row.flips_used >= ipFlipLimit()) return 'limited'
  await admin.from('joke_flips').upsert(
    { subject_key: ipKey, day, flips_used: row.flips_used + cost, sets_flipped: 0, set_ids: [] } as never,
    { onConflict: 'subject_key,day' },
  )
  return 'ok'
}

function toCard(row: {
  id: string | null
  position: number
  angle: string
  text: string
  used_fallback: boolean
  judge_score: number | null
  day?: string
}): JokeCard {
  return {
    id: row.id,
    position: row.position,
    angle: row.angle,
    angleLabel: angleLabel(row.angle),
    text: row.text,
    used_fallback: row.used_fallback,
    judge_score: row.judge_score,
    saved: !!row.id,
    day: row.day,
  }
}

/** The set a caller is allowed to touch: theirs, or their own guest session's. */
async function loadOwnedSet(
  admin: any,
  setId: string,
  userId: string | null,
  anonSessionId: string | null,
) {
  const { data: set } = await admin
    .from('joke_sets')
    .select('id, user_id, anon_session_id, clean_text, archetype, angles')
    .eq('id', setId)
    .maybeSingle()
  if (!set) return null
  const ownsIt = userId
    ? set.user_id === userId || (!set.user_id && !!anonSessionId && set.anon_session_id === anonSessionId)
    : !set.user_id && !!anonSessionId && set.anon_session_id === anonSessionId
  return ownsIt ? set : null
}

// ───────────────────────── 1 · entry ─────────────────────────

export type JokeEntryResult =
  | { crisis: true }
  /** Today's budget is spent. Nothing was scrubbed, classified, stored or
   *  written — the spill never left the composer. */
  | { crisis: false; limited: true; reason: LimitReason | 'rate_limited'; tier: JokeTier; usage: JokeUsage }
  | {
      crisis: false
      limited: false
      set_id: string
      clean_text: string
      archetype: string
      angles: string[]
      notice: string
      tier: JokeTier
    }

export const submitJokeEntry = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) =>
    z.object({ raw: z.string().min(1).max(4000), ...Ctx }).parse(d),
  )
  .handler(async ({ data }): Promise<JokeEntryResult> => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const id = await resolveJokeIdentity(data.anon_session_id ?? null)

    // budget first — before the scrubber, the crisis classifier or a row.
    // A spent counter is answered from the counter alone; no model is asked
    // to write cards that the deal would only refuse.
    const { day, resetsAt } = await resolveDayInfo(supabaseAdmin, id.userId)
    const counter = await readCounter(supabaseAdmin, id.subjectKey, day)
    const usage = usageOf(id.tier, counter, resetsAt)
    const blocked = usageBlock(usage)
    if (blocked) return { crisis: false, limited: true, reason: blocked, tier: id.tier, usage }
    if (await networkSpent(supabaseAdmin, day)) {
      return { crisis: false, limited: true, reason: 'rate_limited', tier: id.tier, usage }
    }

    // scrub first — the raw text is never stored
    const scrubbed = await runScrub(data.raw)
    const clean = scrubbed.clean_text

    // crisis overrides everything. no cards, no gate, no paywall, no signup.
    const crisis = await runClassifyCrisis(clean)
    if (crisis.crisis) {
      await supabaseAdmin.from('crisis_events').insert({
        alias_id: id.userId,
        category: crisis.category,
        severity: crisis.severity,
        resources_shown: true,
      } as never)
      return { crisis: true }
    }

    const archetype = classifyArchetype(clean)
    const angles = dealSlots()

    const { data: row, error } = await supabaseAdmin
      .from('joke_sets')
      .insert({
        user_id: id.userId,
        anon_session_id: id.userId ? null : (data.anon_session_id ?? null),
        clean_text: clean,
        archetype,
        angles,
        is_seed: false,
        corpus_eligible: false,
      } as never)
      .select('id')
      .single()
    if (error || !row) throw new Error(error?.message ?? 'could not open that set')

    return {
      crisis: false,
      limited: false,
      set_id: row.id as string,
      clean_text: clean,
      archetype,
      angles,
      notice: scrubbed.notice ?? '',
      tier: id.tier,
    }
  })

// ───────────────────── 2 · deal the three cards ─────────────────────

export type DealResult =
  | { ok: true; cards: JokeCard[]; tier: JokeTier; cards_used: number; sets_used: number; usage: JokeUsage }
  | { ok: false; reason: 'not_found'; tier: JokeTier; usage?: JokeUsage }
  | { ok: false; reason: 'daily_cards' | 'daily_sets' | 'rate_limited'; tier: JokeTier; usage: JokeUsage }

export const dealJokeCards = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => z.object({ set_id: z.string().uuid(), ...Ctx }).parse(d))
  .handler(async ({ data }): Promise<DealResult> => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const id = await resolveJokeIdentity(data.anon_session_id ?? null)
    const { day, resetsAt } = await resolveDayInfo(supabaseAdmin, id.userId)

    const set = await loadOwnedSet(supabaseAdmin, data.set_id, id.userId, data.anon_session_id ?? null)
    if (!set) return { ok: false, reason: 'not_found', tier: id.tier }

    const angles = ((set.angles as string[]) ?? []).slice(0, 3)
    if (angles.length !== 3) return { ok: false, reason: 'not_found', tier: id.tier }

    // Already dealt? Hand the same three back. A retry, a refresh or a double
    // tap must never cost a second deal.
    if (id.userId) {
      const { data: rows } = await supabaseAdmin
        .from('joke_cards')
        .select('id, angle, card_text, position, used_fallback, judge_score, created_at')
        .eq('set_id', set.id)
        .order('position', { ascending: true })
      if (rows && rows.length >= 3) {
        const counter = await readCounter(supabaseAdmin, id.subjectKey, day)
        return {
          ok: true,
          tier: id.tier,
          cards_used: counter.flips_used,
          sets_used: counter.sets_flipped,
          usage: usageOf(id.tier, counter, resetsAt),
          cards: rows.map((r: any) =>
            toCard({
              id: r.id,
              position: r.position,
              angle: r.angle,
              text: r.card_text,
              used_fallback: !!r.used_fallback,
              judge_score: r.judge_score ?? null,
              day: String(r.created_at).slice(0, 10),
            }),
          ),
        }
      }
    }

    // ── budget, resolved before any model call ──
    const counter = await readCounter(supabaseAdmin, id.subjectKey, day)
    const cap = budget(id.tier)
    const counted = counter.set_ids.includes(set.id as string)
    const usage = usageOf(id.tier, counter, resetsAt)
    if (!counted && counter.sets_flipped >= cap.sets) {
      return { ok: false, reason: 'daily_sets', tier: id.tier, usage }
    }
    if (counter.flips_used + 3 > cap.cards) {
      return { ok: false, reason: 'daily_cards', tier: id.tier, usage }
    }
    if ((await chargeNetwork(supabaseAdmin, day, 3)) === 'limited') {
      return { ok: false, reason: 'rate_limited', tier: id.tier, usage }
    }

    await charge(supabaseAdmin, id.subjectKey, day, counter, 3, set.id as string)
    const charged: JokeUsage = {
      ...usage,
      cards_used: counter.flips_used + 3,
      sets_used: counted ? counter.sets_flipped : counter.sets_flipped + 1,
    }

    const situation = (set.clean_text as string) ?? ''
    const archetype = (set.archetype as string) ?? 'general'
    const lines = await Promise.all(
      angles.map((angle) => generateLine({ angle, archetype, situation })),
    )

    const cards: JokeCard[] = []
    for (let position = 0; position < 3; position++) {
      const angle = angles[position]!
      const out = lines[position]!
      let cardId: string | null = null
      if (id.userId) {
        cardId = await persistCard(supabaseAdmin, {
          setId: set.id as string,
          userId: id.userId,
          position,
          angle,
          text: out.text,
          used_fallback: out.used_fallback,
          judge_score: out.judge_score,
        })
      }
      cards.push(
        toCard({
          id: cardId,
          position,
          angle,
          text: out.text,
          used_fallback: out.used_fallback,
          judge_score: out.judge_score,
          day,
        }),
      )
    }

    if (id.userId) {
      void ingestJokeSignal(id.userId, set.id as string, cards.map((c) => c.text).join(' / ')).catch(() => {})
    }

    return {
      ok: true,
      tier: id.tier,
      cards,
      cards_used: charged.cards_used,
      sets_used: charged.sets_used,
      usage: charged,
    }
  })

/** Write (or replace) one card row and return its id. */
async function persistCard(
  admin: any,
  args: {
    setId: string
    userId: string
    position: number
    angle: string
    text: string
    used_fallback: boolean
    judge_score: number | null
  },
): Promise<string | null> {
  const { data: card } = await admin
    .from('joke_cards')
    .upsert(
      {
        set_id: args.setId,
        user_id: args.userId,
        angle: args.angle,
        card_text: args.text,
        position: args.position,
        used_fallback: args.used_fallback,
        judge_score: args.judge_score,
        is_seed: false,
        corpus_eligible: false,
      } as never,
      { onConflict: 'set_id,position' },
    )
    .select('id')
    .maybeSingle()
  if (card?.id) return card.id as string
  const { data: found } = await admin
    .from('joke_cards')
    .select('id')
    .eq('set_id', args.setId)
    .eq('position', args.position)
    .maybeSingle()
  return (found?.id as string) ?? null
}

// ───────────────────── 3 · another take (reroll) ─────────────────────

export type RerollResult =
  | { ok: true; card: JokeCard; tier: JokeTier; cards_used: number }
  | { ok: false; reason: 'not_found' | 'daily_cards' | 'rate_limited'; tier: JokeTier }

export const rerollJokeCard = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) =>
    z.object({ set_id: z.string().uuid(), position: z.number().int().min(0).max(2), ...Ctx }).parse(d),
  )
  .handler(async ({ data }): Promise<RerollResult> => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const id = await resolveJokeIdentity(data.anon_session_id ?? null)
    const day = await resolveDay(supabaseAdmin, id.userId)

    const set = await loadOwnedSet(supabaseAdmin, data.set_id, id.userId, data.anon_session_id ?? null)
    if (!set) return { ok: false, reason: 'not_found', tier: id.tier }
    const angle = ((set.angles as string[]) ?? [])[data.position]
    if (!angle) return { ok: false, reason: 'not_found', tier: id.tier }

    const counter = await readCounter(supabaseAdmin, id.subjectKey, day)
    if (counter.flips_used + 1 > budget(id.tier).cards) {
      return { ok: false, reason: 'daily_cards', tier: id.tier }
    }
    if ((await chargeNetwork(supabaseAdmin, day, 1)) === 'limited') {
      return { ok: false, reason: 'rate_limited', tier: id.tier }
    }
    await charge(supabaseAdmin, id.subjectKey, day, counter, 1, set.id as string)

    const out = await generateLine({
      angle,
      archetype: (set.archetype as string) ?? 'general',
      situation: (set.clean_text as string) ?? '',
    })

    let cardId: string | null = null
    if (id.userId) {
      cardId = await persistCard(supabaseAdmin, {
        setId: set.id as string,
        userId: id.userId,
        position: data.position,
        angle,
        text: out.text,
        used_fallback: out.used_fallback,
        judge_score: out.judge_score,
      })
      void ingestJokeSignal(id.userId, set.id as string, out.text).catch(() => {})
    }

    return {
      ok: true,
      tier: id.tier,
      cards_used: counter.flips_used + 1,
      card: toCard({
        id: cardId,
        position: data.position,
        angle,
        text: out.text,
        used_fallback: out.used_fallback,
        judge_score: out.judge_score,
        day,
      }),
    }
  })

// Mirror ingest — 🃏 Joke is its own shape, never folded into Spill.
async function ingestJokeSignal(userId: string, setId: string, text: string): Promise<void> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { ingestMirrorSignal } = await import('./mirror-pipeline.functions')
  await ingestMirrorSignal({
    supabase: supabaseAdmin,
    userId,
    data: { source: 'joke', ref_id: setId, text },
  } as never)
}

// ───────────────────── 4 · the export (what money buys) ─────────────────────

export type CardImage = {
  card_id: string
  label: string
  filename: string
  svg: string
}

export type ExportResult = {
  tier: Exclude<JokeTier, 'guest'>
  width: number
  height: number
  mark: boolean
  note: string
  images: CardImage[]
}

/**
 * Render one card, or a whole set, at the caller's tier.
 *
 * The tier is resolved from the token here — a client asking for `mark: false`
 * gets whatever its subscription actually entitles it to. Guests cannot reach
 * this at all: that is the alias gate, and the client raises it before calling.
 */
export const exportJokeCards = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) =>
    z
      .object({
        card_id: z.string().uuid().nullable().optional(),
        set_id: z.string().uuid().nullable().optional(),
        ...Ctx,
      })
      .refine((v) => !!v.card_id || !!v.set_id, { message: 'card_id or set_id required' })
      .parse(d),
  )
  .handler(async ({ data }): Promise<ExportResult> => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const id = await resolveJokeIdentity(data.anon_session_id ?? null)
    if (!id.userId) throw new Error('an alias comes first')
    const tier = id.tier === 'paying' ? 'paying' : 'free'
    const spec = exportSpec(tier)

    // Saving the set in one tap is the paid shape. A free member who asks for
    // one still gets a card back — just the single card, marked, like always.
    const setId = data.set_id ?? null
    const cardId = data.card_id ?? null
    const mine = () =>
      supabaseAdmin
        .from('joke_cards')
        .select('id, set_id, angle, card_text, position, user_id')
        .eq('user_id', id.userId!)
        .order('position', { ascending: true })

    const { data: rows } =
      setId && spec.set
        ? await mine().eq('set_id', setId)
        : cardId
          ? await mine().eq('id', cardId)
          : await mine().eq('set_id', setId!).limit(1)
    if (!rows || rows.length === 0) throw new Error('no card there')

    const setIds = Array.from(new Set(rows.map((r: any) => r.set_id as string)))
    const { data: sets } = await supabaseAdmin
      .from('joke_sets')
      .select('id, clean_text')
      .in('id', setIds)
    const situations = new Map<string, string>(
      (sets ?? []).map((s: any) => [s.id as string, (s.clean_text as string) ?? '']),
    )

    return {
      tier,
      width: spec.width,
      height: spec.height,
      mark: spec.mark,
      note: spec.note,
      images: rows.map((r: any) => {
        const label = angleLabel(r.angle as string)
        return {
          card_id: r.id as string,
          label,
          filename: cardFilename(label, r.id as string),
          svg: renderCardSvg({
            text: String(r.card_text),
            label,
            accent: angleAccent(r.angle as string),
            situation: situations.get(r.set_id as string) ?? '',
            width: spec.width,
            height: spec.height,
            mark: spec.mark,
          }),
        }
      }),
    }
  })

// ───────────────────── 5 · alias gate: claim on sign-in ─────────────────────

const ADJ = ['Quiet','Wistful','Defiant','Restless','Tender','Patient','Bitter','Forlorn','Tired','Honest','Careful','Steady','Wry','Stubborn','Gentle','Sharp','Blunt']
const NAT = ['Filipino','Brazilian','Kenyan','Indian','Ethiopian','Pakistani','Moroccan','Chilean','Polish','Cuban','Vietnamese','Lebanese','Indonesian','Javanese','Peruvian','Greek','Malaysian']
const ANI: [string, string][] = [['Owl','🦉'],['Fox','🦊'],['Bear','🐻'],['Lion','🦁'],['Butterfly','🦋'],['Hedgehog','🦔'],['Swan','🦢'],['Heron','🕊'],['Wolf','🐺'],['Hawk','🦅'],['Crane','🦩'],['Fawn','🦌'],['Otter','🦦'],['Magpie','🐦'],['Deer','🦌'],['Ibis','🪿']]
const rand = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]!

/** One card the guest was holding when the alias gate went up. */
const HeldCard = z.object({
  set_id: z.string().uuid(),
  position: z.number().int().min(0).max(2),
  angle: z.string().max(64),
  text: z.string().min(1).max(240),
  used_fallback: z.boolean().optional(),
  judge_score: z.number().nullable().optional(),
})

export const claimJokeSession = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) =>
    z
      .object({
        /** the three cards the guest was reading, so none of them are lost */
        hold: z.array(HeldCard).max(3).nullable().optional(),
        terms_version: z.string().max(32).optional(),
        ...Ctx,
      })
      .parse(d),
  )

  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const id = await resolveJokeIdentity(data.anon_session_id ?? null)
    // The app bootstraps a Supabase anonymous session for analytics. That
    // session emits SIGNED_IN too, but it is not a real account and must not
    // turn a harmless background claim into an uncaught server-function
    // error. Keep the endpoint closed and return a typed refusal instead.
    if (!id.userId) {
      return {
        ok: false as const,
        reason: 'sign_in_required' as const,
        tier: 'guest' as const,
        alias: null,
        claimed: null,
      }
    }
    const userId = id.userId
    const day = await resolveDay(supabaseAdmin, userId)
    const anonKey = 'anon:' + (data.anon_session_id ?? 'unknown')

    // 1 · mint the pseudonym (only if this account has none yet)
    const { data: existing } = await supabaseAdmin
      .from('aliases')
      .select('user_id, display_name, emoji')
      .eq('user_id', userId)
      .maybeSingle()

    let alias = existing as { display_name: string; emoji: string } | null
    const aliasIsNew = !alias
    if (!alias) {
      for (let attempt = 0; attempt < 40; attempt++) {
        const [creature, emoji] = rand(ANI)
        const emotion = rand(ADJ), nation = rand(NAT)
        const display_name = `${emotion} ${nation} ${creature}`
        const { data: taken } = await supabaseAdmin
          .from('aliases')
          .select('user_id')
          .eq('display_name', display_name)
          .maybeSingle()
        if (taken) continue
        const { error } = await supabaseAdmin.from('aliases').insert({
          user_id: userId,
          emotion,
          nation,
          creature,
          emoji,
          display_name,
          birth_year: 1990,
          birth_month: 1,
          birth_day: 1,
          accepted_terms_version: data.terms_version ?? '2026-09-04',
          accepted_terms_at: new Date().toISOString(),
          accepted_privacy_version: data.terms_version ?? '2026-09-04',
          accepted_privacy_at: new Date().toISOString(),
        } as never)
        if (!error) { alias = { display_name, emoji }; break }
      }
    } else {
      await supabaseAdmin
        .from('aliases')
        .update({
          accepted_terms_version: data.terms_version ?? '2026-09-04',
          accepted_terms_at: new Date().toISOString(),
        } as never)
        .eq('user_id', userId)
    }

    // 2 · claim the guest session's sets
    if (data.anon_session_id) {
      await supabaseAdmin
        .from('joke_sets')
        .update({ user_id: userId, anon_session_id: null } as never)
        .eq('anon_session_id', data.anon_session_id)
        .is('user_id', null)
    }

    // 3 · merge today's counter — signing in never mints a fresh allowance
    const [anonRow, userRow] = await Promise.all([
      readCounter(supabaseAdmin, anonKey, day),
      readCounter(supabaseAdmin, 'user:' + userId, day),
    ])
    const mergedSetIds = Array.from(new Set([...userRow.set_ids, ...anonRow.set_ids]))
    await supabaseAdmin.from('joke_flips').upsert(
      {
        subject_key: 'user:' + userId,
        day,
        flips_used: userRow.flips_used + anonRow.flips_used,
        sets_flipped: mergedSetIds.length,
        set_ids: mergedSetIds,
      } as never,
      { onConflict: 'subject_key,day' },
    )
    if (data.anon_session_id) {
      await supabaseAdmin.from('joke_flips').delete().eq('subject_key', anonKey)
    }

    // 4 · persist the cards they were holding, so the gate costs them nothing
    const claimed: JokeCard[] = []
    for (const hold of data.hold ?? []) {
      const cardId = await persistCard(supabaseAdmin, {
        setId: hold.set_id,
        userId,
        position: hold.position,
        angle: hold.angle,
        text: hold.text,
        used_fallback: hold.used_fallback ?? false,
        judge_score: hold.judge_score ?? null,
      })
      if (!cardId) continue
      claimed.push(
        toCard({
          id: cardId,
          position: hold.position,
          angle: hold.angle,
          text: hold.text,
          used_fallback: hold.used_fallback ?? false,
          judge_score: hold.judge_score ?? null,
          day,
        }),
      )
    }
    if (claimed.length && data.hold?.[0]) {
      void ingestJokeSignal(userId, data.hold[0].set_id, claimed.map((c) => c.text).join(' / ')).catch(() => {})
    }

    return {
      ok: true as const,
      tier: id.tier,
      alias: alias ? { display_name: alias.display_name, emoji: alias.emoji } : null,
      alias_is_new: aliasIsNew,
      claimed,
    }
  })

// ───────────────────────── 6 · the set list ─────────────────────────

export const listMyJokeCards = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => z.object({ ...Ctx }).parse(d ?? {}))
  .handler(async ({ data: input }): Promise<{
    tier: JokeTier
    cards: JokeCard[]
    alias: { display_name: string; emoji: string } | null
    /** today's counter, so the composer knows before it sends */
    usage: JokeUsage
  }> => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const id = await resolveJokeIdentity(input.anon_session_id ?? null)
    const { day, resetsAt } = await resolveDayInfo(supabaseAdmin, id.userId)
    const usage = usageOf(id.tier, await readCounter(supabaseAdmin, id.subjectKey, day), resetsAt)
    if (!id.userId) return { tier: 'guest', cards: [], alias: null, usage }
    const [{ data }, { data: alias }] = await Promise.all([
      supabaseAdmin
        .from('joke_cards')
        .select('id, set_id, angle, card_text, position, used_fallback, judge_score, room_id, created_at')
        .eq('user_id', id.userId)
        .order('created_at', { ascending: false })
        .limit(200),
      supabaseAdmin
        .from('aliases')
        .select('display_name, emoji')
        .eq('user_id', id.userId)
        .maybeSingle(),
    ])
    // The set list reads each card back under the situation it was written
    // for, so every card carries its set's line.
    const setIds = Array.from(new Set((data ?? []).map((r: any) => r.set_id as string)))
    const { data: sets } = setIds.length
      ? await supabaseAdmin.from('joke_sets').select('id, clean_text').in('id', setIds)
      : { data: [] as { id: string; clean_text: string }[] }
    const situations = new Map<string, string>(
      (sets ?? []).map((s: any) => [s.id as string, (s.clean_text as string) ?? '']),
    )
    const cards: JokeCard[] = (data ?? []).map((r: any) => ({
      ...toCard({
        id: r.id as string,
        position: (r.position as number) ?? 0,
        angle: r.angle as string,
        text: r.card_text as string,
        used_fallback: !!r.used_fallback,
        judge_score: (r.judge_score as number | null) ?? null,
        day: String(r.created_at).slice(0, 10),
      }),
      room_id: (r.room_id as string | null) ?? null,
      set_id: (r.set_id as string | null) ?? null,
      situation: situations.get(r.set_id as string) ?? '',
    }))
    return {
      tier: id.tier,
      cards,
      alias: alias
        ? { display_name: alias.display_name as string, emoji: alias.emoji as string }
        : null,
      usage,
    }
  })

// ───────────────────── 7 · post a card to a room ─────────────────────

export const postJokeCardToRoom = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => z.object({ card_id: z.string().uuid(), ...Ctx }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const id = await resolveJokeIdentity(data.anon_session_id ?? null)
    if (!id.userId) throw new Error('sign in first')

    const { data: card } = await supabaseAdmin
      .from('joke_cards')
      .select('id, user_id, set_id, card_text, angle, room_id')
      .eq('id', data.card_id)
      .maybeSingle()
    if (!card || card.user_id !== id.userId) throw new Error('forbidden')
    if (card.room_id) return { room_id: card.room_id as string, already: true, alias: null }

    const { data: alias } = await supabaseAdmin
      .from('aliases')
      .select('display_name, emoji')
      .eq('user_id', id.userId)
      .maybeSingle()

    const { data: set } = await supabaseAdmin
      .from('joke_sets')
      .select('clean_text')
      .eq('id', card.set_id)
      .maybeSingle()

    const title = String(card.card_text).slice(0, 90)
    const { data: situation, error: sitErr } = await supabaseAdmin
      .from('situations')
      .insert({
        alias_id: id.userId,
        pillar: 'family',
        clean_text: (set?.clean_text as string) ?? String(card.card_text),
        kind: 'joke',
        title,
        body: String(card.card_text),
        is_public: true,
        crisis_flag: false,
        is_seed: false,
        status: 'open',
      } as never)
      .select('id')
      .single()
    if (sitErr || !situation) throw new Error(sitErr?.message ?? 'could not open a room')

    const { data: room, error: roomErr } = await supabaseAdmin
      .from('rooms')
      .insert({
        author_id: id.userId,
        alias: (alias?.display_name as string) ?? 'someone',
        emoji: (alias?.emoji as string) ?? '🃏',
        title,
        body: String(card.card_text),
        support: 'heard',
        hall: 'relatable',
        source: 'joke',
      } as never)
      .select('id')
      .single()
    if (roomErr || !room) throw new Error(roomErr?.message ?? 'could not open a room')

    await supabaseAdmin.from('situations').update({ room_id: room.id } as never).eq('id', situation.id)
    await supabaseAdmin.from('joke_cards').update({ room_id: room.id } as never).eq('id', card.id)

    return {
      room_id: room.id as string,
      already: false,
      alias: (alias?.display_name as string) ?? 'someone',
    }
  })
