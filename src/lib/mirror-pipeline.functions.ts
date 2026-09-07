// Mirror collection pipeline. Two-phase so callers can guarantee durable
// signal persistence without paying LLM latency.
//
//   PHASE 1 — enqueue (fast, awaited by callers):
//     upsert a mirror_signals row (pattern_id NULL). This is one cheap insert.
//
//   PHASE 2 — crystallize (slow, best-effort):
//     scrub (optional) -> embed -> match against THIS user's mirror_patterns
//       match    -> deepen (sources++, count, depth, trend, last_seen)
//       no match -> reading -> insert new pattern (cap 40 active) -> punch
//     -> UPDATE the mirror_signals row: set pattern_id + embedding.
//
// If phase 2 dies (serverless freeze, crash), the enqueued row survives with
// pattern_id NULL and the nightly sweep in
// src/routes/api/public/hooks/mirror-evolution.ts picks it up.
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { runScrub } from './agents/scrubber.functions'
import { embedText, toVectorLiteral } from './agents/embeddings.server'
import { runMirrorReadingCore, runMirrorPunchCore } from './agents/mirror.functions'
import {
  type District,
  normalizeDistrict,
} from './agents/mirror-guards'

const ACTIVE_CAP = 40

/* Keep in step with the CHECK constraint on mirror_signals.source: a source
   missing there is rejected by the database on insert and the enqueue fails
   quietly, which is exactly how 'joke' went unnoticed. */
const Source = z.enum(['spill', 'scan', 'comments', 'likes', 'follows', 'browse', 'joke'])
type SourceT = z.infer<typeof Source>

const IngestInput = z.object({
  source: Source,
  ref_id: z.string().min(1).max(120),
  raw_text: z.string().max(8000).default(''),
  district_hint: z.string().optional(),
  // Callers pass pre_scrubbed=true when raw_text already went through
  // runScrub (saveSituation, createComment, spill) so phase 2 can skip the
  // duplicate LLM scrub round-trip.
  pre_scrubbed: z.boolean().optional().default(false),
  // Admin-only seed marker; propagates to mirror_signals and any
  // pattern crystallized from a seed signal.
  is_seed: z.boolean().optional().default(false),
})

type PatternRow = {
  id: string
  user_id: string
  name: string
  district: District
  count: number
  depth: number
  trend: number[]
  sources: Record<string, number>
  embedding: string | null
  insight: string | null
  last_seen: string
}

function depthFor(count: number): number {
  if (count < 3) return 1
  if (count < 7) return 2
  if (count < 15) return 3
  if (count < 30) return 4
  return 5
}


function pushTrend(trend: number[]): number[] {
  const arr = (Array.isArray(trend) && trend.length === 7 ? [...trend] : [0, 0, 0, 0, 0, 0, 0]).map(Number)
  arr[6] = (arr[6] ?? 0) + 1
  return arr
}

function trendDir(trend: number[]): 'rising' | 'steady' | 'cooling' | 'dormant' {
  const a = trend ?? []
  const last = a[6] ?? 0
  const prev = a[5] ?? 0
  const prev2 = a[4] ?? 0
  if (last > prev && prev >= prev2) return 'rising'
  if (last < prev) return 'cooling'
  return 'steady'
}

// Fetch up to 3 recent scrubbed excerpts for a pattern so the punch prompt
// can anchor the hero line in what the user actually said. Includes the
// current cleaned text (if any) as the freshest excerpt.
async function recentPatternExcerpts(
  supabase: any,
  patternId: string,
  currentText: string,
): Promise<string[]> {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (s: string | null | undefined) => {
    const t = (s ?? '').trim()
    if (!t) return
    const key = t.slice(0, 80).toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(t.slice(0, 400))
  }
  push(currentText)
  try {
    const { data } = await supabase
      .from('mirror_signals')
      .select('text_scrubbed')
      .eq('pattern_id', patternId)
      .order('created_at', { ascending: false })
      .limit(6)
    for (const r of (data ?? []) as Array<{ text_scrubbed: string | null }>) {
      push(r.text_scrubbed)
      if (out.length >= 3) break
    }
  } catch { /* fail-soft */ }
  return out.slice(0, 3)
}

export type IngestMirrorInput = z.input<typeof IngestInput>

// ---------- PHASE 1 — durable enqueue ----------

type EnqueueResult = {
  signal_id: string | null
  pattern_id: string | null
  alreadyLinked: boolean
}

async function enqueueMirrorSignal(args: {
  supabase: any
  userId: string
  data: IngestMirrorInput
}): Promise<EnqueueResult> {
  const { supabase, userId, data } = args

  const { data: existing, error: exErr } = await supabase
    .from('mirror_signals')
    .select('id, pattern_id')
    .eq('user_id', userId)
    .eq('source', data.source)
    .eq('ref_id', data.ref_id)
    .maybeSingle()
  if (exErr) console.error('[mirror-ingest] enqueue select', exErr)
  if (existing?.pattern_id) {
    return { signal_id: existing.id as string, pattern_id: existing.pattern_id as string, alreadyLinked: true }
  }
  if (existing) {
    return { signal_id: existing.id as string, pattern_id: null, alreadyLinked: false }
  }

  const { data: ins, error: insErr } = await supabase
    .from('mirror_signals')
    .insert({
      user_id: userId,
      source: data.source,
      ref_id: data.ref_id,
      text_scrubbed: data.raw_text ?? '',
      pattern_id: null,
      is_seed: !!data.is_seed,
    } as never)
    .select('id')
    .single()
  if (insErr) {
    // Concurrent insert may have won the unique constraint — re-select.
    console.error('[mirror-ingest] enqueue insert', insErr)
    const { data: after } = await supabase
      .from('mirror_signals')
      .select('id, pattern_id')
      .eq('user_id', userId)
      .eq('source', data.source)
      .eq('ref_id', data.ref_id)
      .maybeSingle()
    if (after) {
      return {
        signal_id: after.id as string,
        pattern_id: (after.pattern_id as string) ?? null,
        alreadyLinked: !!after.pattern_id,
      }
    }
    return { signal_id: null, pattern_id: null, alreadyLinked: false }
  }
  return { signal_id: (ins as { id: string }).id, pattern_id: null, alreadyLinked: false }
}

// ---------- PHASE 2 — crystallize (best-effort) ----------

export async function crystallizeMirrorSignal(args: {
  supabase: any
  userId: string
  signal_id: string
  data: IngestMirrorInput
}): Promise<{ pattern_id: string | null }> {
  const { supabase, userId, signal_id, data } = args

  // 1. scrub — skip if caller already scrubbed
  let cleaned = data.raw_text ?? ''
  if (!data.pre_scrubbed && cleaned.trim()) {
    try {
      const s = await runScrub(cleaned.slice(0, 4000))
      cleaned = s.clean_text ?? cleaned
    } catch { /* keep pre-scrubbed / raw */ }
  }

  // 2. embed (fail-soft)
  const embeddingText = cleaned || `${data.source} signal`
  const vec = await embedText(embeddingText)
  const vecLiteral = vec ? toVectorLiteral(vec) : null

  // 3. match nearest existing pattern for THIS user
  let matched: { id: string; similarity: number } | null = null
  if (vecLiteral) {
    const { data: hits, error: rpcErr } = await supabase.rpc('match_user_patterns', {
      p_user: userId,
      q: vecLiteral as unknown as never,
      match_count: 1,
      similarity_floor: 0.72,
    })
    if (rpcErr) console.error('[mirror-ingest] match_user_patterns', rpcErr)
    if (Array.isArray(hits) && hits[0]) matched = { id: hits[0].id, similarity: hits[0].similarity }
  }

  let patternId: string | null = null

  if (matched) {
    // ---- DEEPEN ----
    const { data: row, error: rowErr } = await supabase
      .from('mirror_patterns')
      .select('id, user_id, name, district, count, depth, trend, sources, embedding, insight, last_seen')
      .eq('id', matched.id)
      .single()
    if (rowErr) console.error('[mirror-ingest] deepen select', rowErr)
    if (row) {
      const p = row as unknown as PatternRow
      const nextSources = { ...(p.sources ?? {}) } as Record<SourceT, number>
      nextSources[data.source] = (nextSources[data.source] ?? 0) + 1
      const nextCount = Object.values(nextSources).reduce((a, b) => a + Number(b || 0), 0)
      const nextTrend = pushTrend(p.trend)
      const beforeDepth = p.depth
      const nextDepth = depthFor(nextCount)
      const update: Record<string, unknown> = {
        sources: nextSources,
        count: nextCount,
        depth: nextDepth,
        trend: nextTrend,
        trend_dir: trendDir(nextTrend),
        last_seen: new Date().toISOString(),
        state: 'active',
      }
      // Always regenerate the hero line when a pattern deepens — the
      // supportive prompt uses the fresh count/depth/sources numbers plus
      // recent excerpts of what the user actually said, so the line stays
      // grounded in their real words.
      try {
        const excerpts = await recentPatternExcerpts(supabase, matched.id, cleaned)
        const punch = await runMirrorPunchCore({
          name: p.name,
          district: p.district,
          count: nextCount,
          depth: nextDepth,
          sources: nextSources as Record<string, number>,
          trend: nextTrend,
          insight: p.insight ?? '',
          excerpts,
        })
        update.punch = punch.punch
        update.record = punch.record
      } catch { /* keep existing punch */ }
      void beforeDepth

      const { error: updErr } = await supabase.from('mirror_patterns').update(update as never).eq('id', matched.id)
      if (updErr) console.error('[mirror-ingest] deepen update', updErr)
      patternId = matched.id
    }
  } else {
    // ---- CRYSTALLIZE (respect active cap) ----
    const { count: activeCount, error: countErr } = await supabase
      .from('mirror_patterns')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('state', 'active')
    if (countErr) console.error('[mirror-ingest] active-count', countErr)
    if ((activeCount ?? 0) >= ACTIVE_CAP) {
      // at cap; leave the signal unattached, provenance already stored
      await finalizeSignal(supabase, signal_id, null, cleaned, vecLiteral)
      return { pattern_id: null }
    }
    let reading
    try {
      reading = await runMirrorReadingCore({
        scrubbed_text: cleaned || `signal of type ${data.source}`,
        district_hint: data.district_hint,
      })
    } catch { reading = null }
    if (!reading) {
      await finalizeSignal(supabase, signal_id, null, cleaned, vecLiteral)
      return { pattern_id: null }
    }
    const district = normalizeDistrict(reading.trait.district)
    const initialSources: Record<SourceT, number> = {
      spill: 0, scan: 0, comments: 0, likes: 0, follows: 0, browse: 0, joke: 0,
    }
    initialSources[data.source] = 1
    const initialTrend = [0, 0, 0, 0, 0, 0, 1]
    const insertRow: Record<string, unknown> = {
      user_id: userId,
      is_demo: false,
      is_seed: !!data.is_seed,
      name: reading.trait.name,
      emoji: reading.trait.emoji,
      district,
      rarity: reading.trait.rarity,
      insight: reading.trait.insight,
      punch: reading.burn,
      record: reading.filed,
      count: 1,
      depth: 1,
      trend: initialTrend,
      trend_dir: 'rising',
      sources: initialSources,
      embedding: vecLiteral as never,
    }
    const { data: inserted, error: insErr } = await supabase
      .from('mirror_patterns')
      .insert(insertRow as never)
      .select('id, name, district, count, depth, sources, trend, insight')
      .single()
    if (insErr) console.error('[mirror-ingest] crystallize insert', insErr)
    if (inserted) {
      patternId = (inserted as { id: string }).id
      try {
        const punch = await runMirrorPunchCore({
          name: (inserted as { name: string }).name,
          district,
          count: 1,
          depth: 1,
          sources: initialSources as Record<string, number>,
          trend: initialTrend,
          insight: reading.trait.insight,
          excerpts: cleaned ? [cleaned] : [],
        })
        const { error: punchErr } = await supabase
          .from('mirror_patterns')
          .update({ punch: punch.punch, record: punch.record } as never)
          .eq('id', patternId)
        if (punchErr) console.error('[mirror-ingest] punch update', punchErr)
      } catch { /* keep crystallization burn */ }
    }
  }

  // Attach the signal to the resolved pattern.
  await finalizeSignal(supabase, signal_id, patternId, cleaned, vecLiteral)
  return { pattern_id: patternId }
}

async function finalizeSignal(
  supabase: any,
  signal_id: string,
  pattern_id: string | null,
  text_scrubbed: string,
  vecLiteral: string | null,
) {
  const update: Record<string, unknown> = { pattern_id, text_scrubbed }
  if (vecLiteral) update.embedding = vecLiteral as unknown as never
  const { error } = await supabase
    .from('mirror_signals')
    .update(update as never)
    .eq('id', signal_id)
  if (error) console.error('[mirror-ingest] signal finalize', error)
}

// ---------- Public callers ----------

// Fast, durable path: awaits phase 1 only; crystallization happens
// in-request but is not awaited by the caller. Publish latency is bounded
// by one INSERT, and the signal survives even if the runtime freezes.
export async function ingestMirrorSignal(args: {
  supabase: any
  userId: string
  data: IngestMirrorInput
}): Promise<{ ok: true; signal_id: string | null; pattern_id: string | null }> {
  const enq = await enqueueMirrorSignal(args)
  if (enq.alreadyLinked || !enq.signal_id) {
    return { ok: true, signal_id: enq.signal_id, pattern_id: enq.pattern_id }
  }
  // best-effort; nightly sweep catches signals whose crystallize never lands.
  void crystallizeMirrorSignal({
    supabase: args.supabase,
    userId: args.userId,
    signal_id: enq.signal_id,
    data: args.data,
  }).catch((err) => console.error('[mirror-ingest] crystallize (bg)', err))
  return { ok: true, signal_id: enq.signal_id, pattern_id: null }
}

// Full-await path: enqueue + crystallize before returning. Used by
// recordMirrorEvent (browser-initiated likes/browse/etc.) and the backfill,
// where the caller already accepts the full LLM latency.
export async function runIngestMirrorEvent(args: {
  supabase: any
  userId: string
  data: IngestMirrorInput
}): Promise<{ ok: true; pattern_id: string | null }> {
  const enq = await enqueueMirrorSignal(args)
  if (enq.alreadyLinked || !enq.signal_id) {
    return { ok: true, pattern_id: enq.pattern_id }
  }
  const res = await crystallizeMirrorSignal({
    supabase: args.supabase,
    userId: args.userId,
    signal_id: enq.signal_id,
    data: args.data,
  })
  return { ok: true, pattern_id: res.pattern_id }
}

// Nightly sweep entry point — runs crystallize for orphaned mirror_signals
// rows (pattern_id NULL, older than the grace window). Caller passes a
// service-role client since there is no user session under pg_cron; every
// operation stays scoped to the signal's own user_id.
export async function sweepOrphanMirrorSignals(args: {
  supabase: any
  olderThanMinutes?: number
  limit?: number
}): Promise<{ swept: number; linked: number }> {
  const olderThan = args.olderThanMinutes ?? 10
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 200)
  const cutoff = new Date(Date.now() - olderThan * 60_000).toISOString()

  const { data: rows, error } = await args.supabase
    .from('mirror_signals')
    .select('id, user_id, source, ref_id, text_scrubbed')
    .is('pattern_id', null)
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) {
    console.error('[mirror-sweep] select orphans', error)
    return { swept: 0, linked: 0 }
  }

  let linked = 0
  for (const r of (rows ?? []) as Array<{ id: string; user_id: string; source: SourceT; ref_id: string; text_scrubbed: string }>) {
    try {
      const res = await crystallizeMirrorSignal({
        supabase: args.supabase,
        userId: r.user_id,
        signal_id: r.id,
        data: {
          source: r.source,
          ref_id: r.ref_id,
          raw_text: r.text_scrubbed ?? '',
          pre_scrubbed: true,
        },
      })
      if (res.pattern_id) linked++
    } catch (err) {
      console.error('[mirror-sweep] crystallize', r.id, err)
    }
  }
  return { swept: (rows ?? []).length, linked }
}

// ---------- server-fn wrappers ----------

export const ingestMirrorEvent = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IngestInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; pattern_id: string | null }> => {
    return runIngestMirrorEvent({ supabase: context.supabase, userId: context.userId, data })
  })

// ----- read helpers used by render layer -----

export const listMirrorPatterns = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from('mirror_patterns')
      .select('id, name, emoji, district, rarity, state, insight, punch, record, count, depth, trend, trend_dir, sources, first_seen, last_seen')
      .eq('user_id', context.userId)
      .eq('is_demo', false)
      .order('last_seen', { ascending: false })
      .limit(60)
    return data ?? []
  })

// Demo/seed patterns are retired. Kept exported so existing imports don't
// break, but unconditionally returns []; is_demo=true rows are unreachable.
export const listDemoPatterns = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return [] as never[]
  })
